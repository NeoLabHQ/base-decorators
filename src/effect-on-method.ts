import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import type { EffectHooks, HookContext, HooksOrFactory, UnwrapPromise } from './hook.types';
import { getParameterNames } from './getParameterNames';

/**
 * Symbol sentinel set on every function wrapped by {@link EffectOnMethod}.
 *
 * Used by `EffectOnClass` to detect methods that have already been wrapped
 * at the method level, preventing double-wrapping when both class-level
 * and method-level decorators are applied.
 */
export const EFFECT_APPLIED_KEY: unique symbol = Symbol('effectApplied');

/**
 * Method decorator factory that wraps `descriptor.value` with lifecycle hooks.
 *
 * The wrapped function preserves `this` context and transparently handles
 * both sync and async (Promise-returning) methods. After wrapping, the
 * {@link EFFECT_APPLIED_KEY} sentinel is set on the new function via
 * `setMeta`, and any existing `_symMeta` metadata from the original
 * function is copied to the wrapper.
 *
 * @typeParam R - The return type of the decorated method
 * @param hooksOrFactory - Lifecycle callbacks (all optional) or a factory
 *                         function that receives a {@link HookContext} and
 *                         returns hooks. The factory is called once per
 *                         method invocation, before any hooks fire.
 * @param exclusionKey   - Optional symbol used to mark the wrapped method. When
 *                         provided, this key is set instead of the default
 *                         {@link EFFECT_APPLIED_KEY}. This allows different
 *                         Effect-based decorators (e.g. `@Log`, `@Metrics`) to
 *                         use independent markers that do not interfere with
 *                         each other during class-level decoration.
 * @returns A standard `MethodDecorator`
 *
 * @example
 * ```ts
 * class Service {
 *   \@EffectOnMethod({
 *     onInvoke: ({ args, propertyKey }) => console.log('called', propertyKey, args),
 *     onReturn: ({ result }) => { console.log('done'); return result; },
 *     onError: ({ propertyKey, error }) => { console.error(propertyKey, 'failed:', error); throw error; },
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const EffectOnMethod = <R = unknown>(
  hooksOrFactory: HooksOrFactory<R>,
  exclusionKey: symbol = EFFECT_APPLIED_KEY,
): MethodDecorator => {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const parameterNames = getParameterNames(originalMethod);

    const invoke = createInvoker(
      originalMethod,
      parameterNames,
      hooksOrFactory,
      propertyKey,
      descriptor,
    );

    const wrapped = function (this: object, ...args: unknown[]): unknown {
      return invoke(this, args);
    };

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;
    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};

/**
 * Creates the runtime invoker function. All decoration-time state
 * (original method, parameter names, descriptor) is captured in the closure.
 */
const createInvoker = <R>(
  originalMethod: Function,
  parameterNames: string[],
  hooksOrFactory: HooksOrFactory<R>,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): ((self: object, args: unknown[]) => unknown) => {
  const buildContext = createContextBuilder(parameterNames, propertyKey, descriptor);

  return (self, args) => {
    const context = buildContext(self, args);
    const hooks = resolveHooks(hooksOrFactory, context);

    if (!hooks.onInvoke) {
      return execute(originalMethod, context, hooks);
    }

    const invokeResult = hooks.onInvoke(context);

    if (invokeResult instanceof Promise) {
      return invokeResult.then(() => execute(originalMethod, context, hooks));
    }

    return execute(originalMethod, context, hooks);
  };
};

/**
 * Builds a function that constructs a {@link HookContext} for each call.
 *
 * Created once at decoration time; reuses cached parameter names and descriptor.
 */
const createContextBuilder = (
  parameterNames: string[],
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): ((self: object, args: unknown[]) => HookContext) => {
  return (self, args) => {
    const argsObject = buildArgsObject(parameterNames, args);
    const className = (self.constructor as { name: string }).name ?? '';

    return {
      argsObject,
      args,
      target: self,
      propertyKey,
      descriptor,
      parameterNames,
      className,
    };
  };
};

/**
 * Resolves hooks from a static object or a factory function.
 */
const resolveHooks = <R>(
  hooksOrFactory: HooksOrFactory<R>,
  context: HookContext,
): EffectHooks<R> => {
  if (typeof hooksOrFactory === 'function') {
    return hooksOrFactory(context);
  }
  return hooksOrFactory;
};

/**
 * Adapter that applies the three lifecycle outcomes (success, error, cleanup)
 * for a single invocation context.
 */
type PipelineAdapter<T> = {
  mapSuccess(value: T): unknown;
  mapError(err: unknown): unknown;
  cleanup(): void | Promise<void>;
};

/**
 * Creates a pipeline adapter bound to a specific context and hooks set.
 */
const createPipelineAdapter = <R>(
  context: HookContext,
  hooks: EffectHooks<R>,
): PipelineAdapter<UnwrapPromise<R>> => ({
  mapSuccess(value) {
    if (hooks.onReturn) {
      return hooks.onReturn({ ...context, result: value });
    }
    return value;
  },
  mapError(err) {
    if (hooks.onError) {
      return hooks.onError({ ...context, error: err });
    }
    throw err;
  },
  cleanup() {
    if (hooks.finally) {
      return hooks.finally(context);
    }
  },
});

/**
 * Executes the original method and routes the outcome through hooks.
 *
 * Preserves the fast path that calls the original method directly
 * when no lifecycle hooks need to run.
 */
const execute = <R>(
  originalMethod: Function,
  context: HookContext,
  hooks: EffectHooks<R>,
): unknown => {
  if (!hooks.onReturn && !hooks.onError && !hooks.finally) {
    return originalMethod.apply(context.target, context.args);
  }

  const adapter = createPipelineAdapter(context, hooks);

  const result = runPipelineSync(adapter, () =>
    originalMethod.apply(context.target, context.args),
  );

  if (result instanceof Promise) {
    return runPipelineAsync(adapter, result as Promise<UnwrapPromise<R>>);
  }

  return result;
};

/**
 * Runs the full lifecycle pipeline for a synchronous method call.
 *
 * Sequences: action -> mapSuccess -> cleanup, or on error -> mapError -> cleanup.
 * If the action returns a Promise, it is returned unprocessed so the caller
 * can delegate to {@link runPipelineAsync}.
 */
const runPipelineSync = <T>(
  adapter: PipelineAdapter<T>,
  action: () => T,
): unknown => {
  try {
    const result = action();

    if (result instanceof Promise) {
      return result;
    }

    const mapped = adapter.mapSuccess(result);
    adapter.cleanup();
    return mapped;
  } catch (error) {
    try {
      return adapter.mapError(error);
    } finally {
      adapter.cleanup();
    }
  }
};

/**
 * Runs the full lifecycle pipeline for an asynchronous method call.
 *
 * Sequences: promise -> mapSuccess -> cleanup, or on rejection -> mapError -> cleanup.
 */
const runPipelineAsync = async <T>(
  adapter: PipelineAdapter<T>,
  promise: Promise<T>,
): Promise<unknown> => {
  try {
    const value = await promise;
    const mapped = await adapter.mapSuccess(value);
    await adapter.cleanup();
    return mapped;
  } catch (error) {
    try {
      return await adapter.mapError(error);
    } finally {
      await adapter.cleanup();
    }
  }
};

/**
 * Builds an object mapping parameter names to their values.
 */
export const buildArgsObject = (
  parameterNames: string[],
  args: unknown[],
): Record<string, unknown> | undefined => {
  if (args.length === 0 && parameterNames.length === 0) {
    return undefined;
  }

  const argsObject: Record<string, unknown> = {};

  parameterNames.forEach((paramName, index) => {
    if (index < args.length) {
      argsObject[paramName] = args[index];
    }
  });

  return argsObject;
};

/**
 * Copies the `_symMeta` Map from the original function to a new function.
 */
const copySymMeta = (
  source: Function,
  target: Function,
): void => {
  const sourceRecord = source as unknown as Record<string, unknown>;
  const sourceMap = sourceRecord[SYM_META_PROP] as
    | Map<symbol, unknown>
    | undefined;

  if (!sourceMap || sourceMap.size === 0) return;

  const targetRecord = target as unknown as Record<string, unknown>;

  if (!targetRecord[SYM_META_PROP]) {
    Object.defineProperty(target, SYM_META_PROP, {
      value: new Map<symbol, unknown>(),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  const targetMap = targetRecord[SYM_META_PROP] as Map<symbol, unknown>;
  sourceMap.forEach((value, key) => {
    targetMap.set(key, value);
  });
};
