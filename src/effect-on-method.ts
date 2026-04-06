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

    // Extract parameter names at decoration time (once, not per-call)
    const parameterNames = getParameterNames(originalMethod);

    const wrapped = wrapFunction(
      originalMethod,
      parameterNames,
      propertyKey,
      descriptor,
      hooksOrFactory,
    );

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;

    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};



/**
 * Builds an object mapping parameter names to their values.
 *
 * Creates a record where keys are parameter names and values are the
 * corresponding argument values passed to the function.
 *
 * @param parameterNames - Array of parameter names
 * @param args - Array of argument values
 * @returns Object mapping parameter names to values, or undefined when empty
 *
 * @example
 * buildArgsObject(['id', 'name'], [1, 'John'])
 * // Returns: { id: 1, name: 'John' }
 *
 * @internal
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
 * Builds the per-method wrapper used by {@link EffectOnMethod}: constructs
 * {@link HookContext}, resolves hooks, and wires `onInvoke` plus execution.
 */
export const wrapFunction = <R = unknown>(
  originalMethod: (...args: unknown[]) => unknown,
  parameterNames: string[],
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
  hooksOrFactory: HooksOrFactory<R>,
): ((this: object, ...args: unknown[]) => unknown) =>
  function (this: object, ...args: unknown[]): unknown {
    const argsObject = buildArgsObject(parameterNames, args);
    const className = (this.constructor as { name: string }).name ?? '';

    const context: HookContext = {
      argsObject,
      args,
      target: this,
      propertyKey,
      descriptor,
      parameterNames,
      className,
    };

    const hooks = resolveHooks(hooksOrFactory, context);

    const executeMethod = attachHooks(originalMethod, this, args, context, hooks);

    if (hooks.onInvoke) {
      const invokeResult = hooks.onInvoke(context);

      if (invokeResult instanceof Promise) {
        return invokeResult.then(executeMethod);
      }
    }

    return executeMethod();
  };

/**
 * Returns a thunk that runs the original method and applies sync/async lifecycle hooks.
 *
 * Kept as a thunk so async `onInvoke` can defer execution via `.then()`.
 * `finally` is applied inline on sync paths to avoid double-calling when
 * `onReturn` or `onError` throw.
 */
export const attachHooks = <R>(
  originalMethod: (...args: unknown[]) => unknown,
  thisArg: object,
  args: unknown[],
  context: HookContext,
  hooks: EffectHooks<R>,
): (() => unknown) => () => {
  try {
    const result = originalMethod.apply(thisArg, args);

    if (result instanceof Promise) {
      return chainAsyncHooks(result, context, hooks);
    }

    try {
      return hooks.onReturn
        ? hooks.onReturn({ ...context, result: result as UnwrapPromise<R> })
        : result;
    } finally {
      hooks.finally?.(context);
    }
  } catch (error: unknown) {
    try {
      if (hooks.onError) {
        return hooks.onError({ ...context, error });
      }

      throw error;
    } finally {
      hooks.finally?.(context);
    }
  }
};



/**
 * Copies the `_symMeta` Map from the original function to a new function.
 *
 * When `EffectOnMethod` replaces `descriptor.value` with a wrapper,
 * any metadata previously set on the original function (e.g. via `@SetMeta`
 * or `@NoLog`) must survive on the new wrapper so downstream consumers
 * (like `EffectOnClass`) can still read it.
 */
const copySymMeta = (source: Function, target: Function): void => {
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
  sourceMap.forEach((value, key) => targetMap.set(key, value));
};

/**
 * Resolves hooks from a static object or factory function.
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
 * Applies lifecycle hooks (onReturn, onError, finally) to an async method result.
 *
 * Uses async/await with try/catch/finally so that onReturn fires after
 * resolution, onError fires after rejection, and finally always fires last.
 */
const chainAsyncHooks = async <R>(
  promise: Promise<unknown>,
  context: HookContext,
  hooks: EffectHooks<R>,
): Promise<unknown> => {
  try {
    const value = await promise;

    return hooks.onReturn
      ? await hooks.onReturn({ ...context, result: value as UnwrapPromise<R> })
      : value;
  } catch (error: unknown) {
    if (hooks.onError) {
      return await hooks.onError({ ...context, error });
    }

    throw error;
  } finally {
    if (hooks.finally) {
      await hooks.finally(context);
    }
  }
};

