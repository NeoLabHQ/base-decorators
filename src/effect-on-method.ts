import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import type { EffectHooks, HookContext, HooksOrFactory, MaybeAsync, UnwrapPromise } from './hook.types';
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

    const invocation = createMethodInvocation<R>(
      originalMethod,
      parameterNames,
      hooksOrFactory,
      propertyKey,
      descriptor,
    );

    const wrapped = function (this: object, ...args: unknown[]): unknown {
      return invocation.invoke(this, args);
    };

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;
    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};

/**
 * Encapsulates the runtime behavior of a single decorated method invocation.
 */
interface MethodInvocation<R> {
  /** Executes the decorated method with the given `this` and arguments. */
  invoke(self: object, args: unknown[]): unknown;
}

/**
 * Creates a {@link MethodInvocation} that captures all decoration-time state
 * (original method, parameter names, hooks) and produces the invocation function.
 *
 * This separates decoration-time concerns from runtime execution concerns.
 */
const createMethodInvocation = <R>(
  originalMethod: Function,
  parameterNames: string[],
  hooksOrFactory: HooksOrFactory<R>,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): MethodInvocation<R> => {
  const buildContext = createContextBuilder(parameterNames, propertyKey, descriptor);

  return {
    invoke(self, args) {
      const context = buildContext(self, args);
      const hooks = resolveHooks(hooksOrFactory, context);

      if (!hooks.onInvoke) {
        return runWithSyncPipeline(originalMethod, context, hooks);
      }

      const invokeResult = hooks.onInvoke(context);

      if (invokeResult instanceof Promise) {
        return invokeResult.then(() => runWithSyncPipeline(originalMethod, context, hooks));
      }

      return runWithSyncPipeline(originalMethod, context, hooks);
    },
  };
};

/**
 * Builds a function that constructs a {@link HookContext} for each call.
 *
 * The builder is created once at decoration time and reuses the cached
 * parameter names and descriptor.
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
 *
 * When `hooksOrFactory` is a function, it is called with the provided
 * context to produce the hooks. Otherwise, the static hooks are returned.
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
 * Pipeline interface for applying lifecycle hooks to a synchronous outcome.
 */
interface SyncHookPipeline<R> {
  /** Transforms a successful result through `onReturn` (if defined). */
  success(value: R): MaybeAsync<R>;

  /** Transforms an error through `onError` (if defined) or re-throws. */
  error(err: unknown): MaybeAsync<R>;

  /** Runs the `finally` hook (if defined). */
  cleanup(): void;
}

/**
 * Pipeline interface for applying lifecycle hooks to an asynchronous outcome.
 */
interface AsyncHookPipeline<R> {
  /** Transforms a successful result through `onReturn` (if defined). */
  success(value: UnwrapPromise<R>): UnwrapPromise<R> | Promise<UnwrapPromise<R>>;

  /** Transforms an error through `onError` (if defined) or re-throws. */
  error(err: unknown): UnwrapPromise<R> | Promise<UnwrapPromise<R>>;

  /** Runs the `finally` hook (if defined). */
  cleanup(): Promise<void>;
}

/**
 * Creates a sync pipeline that applies hooks without creating promises.
 */
const createSyncPipeline = <R>(
  context: HookContext,
  hooks: EffectHooks<R>,
): SyncHookPipeline<R> => ({
  success(value) {
    return hooks.onReturn
      ? (hooks.onReturn({ ...context, result: value as UnwrapPromise<R> }) as MaybeAsync<R>)
      : (value as MaybeAsync<R>);
  },
  error(err) {
    if (hooks.onError) {
      return hooks.onError({ ...context, error: err }) as MaybeAsync<R>;
    }
    throw err;
  },
  cleanup() {
    if (hooks.finally) {
      hooks.finally(context);
    }
  },
});

/**
 * Creates an async pipeline that applies hooks inside an async boundary.
 */
const createAsyncPipeline = <R>(
  context: HookContext,
  hooks: EffectHooks<R>,
): AsyncHookPipeline<R> => ({
  success(value) {
    if (hooks.onReturn) {
      return hooks.onReturn({ ...context, result: value }) as UnwrapPromise<R>;
    }
    return value;
  },
  error(err) {
    if (hooks.onError) {
      return hooks.onError({ ...context, error: err }) as UnwrapPromise<R>;
    }
    throw err;
  },
  async cleanup() {
    if (hooks.finally) {
      await hooks.finally(context);
    }
  },
});

/**
 * Executes the original method and routes the outcome through the sync pipeline.
 *
 * If the method returns a Promise, delegates to the async execution path
 * while preserving the promise-optimization fast path.
 */
const runWithSyncPipeline = <R>(
  originalMethod: Function,
  context: HookContext,
  hooks: EffectHooks<R>,
): unknown => {
  const pipeline = createSyncPipeline<R>(context, hooks);

  try {
    const result = originalMethod.apply(context.target, context.args);

    if (result instanceof Promise) {
      return runWithAsyncPipeline(result as Promise<UnwrapPromise<R>>, context, hooks);
    }

    try {
      return pipeline.success(result as R);
    } catch (error) {
      return pipeline.error(error);
    } finally {
      pipeline.cleanup();
    }
  } catch (error) {
    try {
      return pipeline.error(error);
    } finally {
      pipeline.cleanup();
    }
  }
};

/**
 * Executes async hooks for a Promise-returning method.
 *
 * Preserves the fast path that returns the original promise unchanged
 * when no async lifecycle hooks are present.
 */
const runWithAsyncPipeline = <R>(
  promise: Promise<UnwrapPromise<R>>,
  context: HookContext,
  hooks: EffectHooks<R>,
): Promise<UnwrapPromise<R>> => {
  if (!hooks.onReturn && !hooks.onError && !hooks.finally) {
    return promise;
  }

  const pipeline = createAsyncPipeline<R>(context, hooks);

  return (async () => {
    try {
      const value = await promise;
      return await pipeline.success(value);
    } catch (error) {
      return await pipeline.error(error);
    } finally {
      await pipeline.cleanup();
    }
  })();
};

/**
 * Builds an object mapping parameter names to their values.
 *
 * Creates a record where keys are parameter names and values are the
 * corresponding argument values passed to the function.
 *
 * @param parameterNames - Array of parameter names
 * @param args - Array of argument values
 * @returns Object mapping parameter names to values
 *
 * @example
 * buildArgsObject(['id', 'name'], [1, 'John'])
 * // Returns: { id: 1, name: 'John' }
 *
 * @internal
 */
export const buildArgsObject = (parameterNames: string[], args: unknown[]): Record<string, unknown> | undefined => {
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
 *
 * When `EffectOnMethod` replaces `descriptor.value` with a wrapper,
 * any metadata previously set on the original function (e.g. via `@SetMeta`
 * or `@NoLog`) must survive on the new wrapper so downstream consumers
 * (like `EffectOnClass`) can still read it.
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
