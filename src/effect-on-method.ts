import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import type { EffectHooks, HookContext, HooksOrFactory } from './hook.types';
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

    const wrapped = function (this: object, ...args: unknown[]): unknown {
      // Build shared context once per invocation
      const context = buildContext(this, parameterNames, args, propertyKey, descriptor);
      const hooks = resolveHooks(hooksOrFactory, context);

      // Phase 1: invoke onInvoke — may return a Promise (awaited) or void
      const onInvokeResult = hooks.onInvoke?.(context);
      if (onInvokeResult instanceof Promise) {
        // Unified chain with guard: only onInvoke-originated errors are handled
        // here. Once `onInvokeCompleted` is true, errors from the method lifecycle
        // (already processed by chainAsyncHooks / handleSyncError) pass through
        // without triggering a second onError / finally cycle.
        let onInvokeCompleted = false;
        return onInvokeResult
          .then(() => {
            onInvokeCompleted = true;
            return runMethod(this, args, originalMethod, context, hooks);
          })
          .catch((error: unknown) => {
            if (onInvokeCompleted) throw error;
            return handleAsyncOnInvokeError(error, context, hooks);
          });
      }

      // Phase 1 completed synchronously — run the method and handle its result
      return runMethod(this, args, originalMethod, context, hooks);
    };

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;

    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};

/**
 * Builds the HookContext object provided to every lifecycle hook.
 */
const buildContext = (
  thisObj: object,
  parameterNames: string[],
  args: unknown[],
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): HookContext => ({
  argsObject: buildArgsObject(parameterNames, args),
  args,
  target: thisObj,
  propertyKey,
  descriptor,
  parameterNames,
  className: (thisObj.constructor as { name: string }).name ?? '',
});

/**
 * Runs the finally hook if provided.
 *
 * Single shared entry point so finally logic appears exactly once and is
 * invoked from both sync and async paths.
 */
const runFinally = <R>(hooks: EffectHooks<R>, context: HookContext): void => {
  if (hooks.finally) {
    hooks.finally(context);
  }
};

/**
 * Shared executor: calls the original method, inspects whether the result is
 * a Promise, and routes to the appropriate lifecycle handler.
 *
 * This is the ONLY location where method invocation + async/sync dispatch
 * occurs — called from both the sync onInvoke path and the async onInvoke
 * success path, eliminating the duplication that existed before.
 */
const runMethod = <R>(
  thisObj: object,
  args: unknown[],
  originalMethod: (...args: unknown[]) => unknown,
  context: HookContext,
  hooks: EffectHooks<R>,
): unknown => {
  try {
    const result = originalMethod.apply(thisObj, args);

    if (result instanceof Promise) {
      return chainAsyncHooks(result as Promise<R>, context, hooks);
    }

    return handleSyncSuccess(result as R, context, hooks);
  } catch (error: unknown) {
    return handleSyncError(error, context, hooks);
  }
};

/**
 * Handles the synchronous success path after `onInvoke` has completed.
 *
 * Runs onReturn if available, then always runs finally.
 */
const handleSyncSuccess = <R>(
  result: R,
  context: HookContext,
  hooks: EffectHooks<R>,
): R => {
  try {
    return hooks.onReturn ? hooks.onReturn({ ...context, result }) : result;
  } finally {
    runFinally(hooks, context);
  }
};

/**
 * Handles the synchronous error path after `onInvoke` has completed.
 *
 * Runs onError if available (may recover or re-throw), then always runs finally.
 */
const handleSyncError = <R>(
  error: unknown,
  context: HookContext,
  hooks: EffectHooks<R>,
): R => {
  try {
    if (hooks.onError) {
      return hooks.onError({ ...context, error });
    }
    throw error;
  } finally {
    runFinally(hooks, context);
  }
};

/**
 * When async onInvoke throws, the original method is NOT called.
 *
 * Runs onError if provided to allow recovery or re-throw; otherwise re-throws.
 * `handleSyncError` also triggers finally exactly once — the caller's `.catch()`
 * path consumes any re-throw as-is (no wrapping needed).
 */
const handleAsyncOnInvokeError = <R>(
  error: unknown,
  context: HookContext,
  hooks: EffectHooks<R>,
): R => handleSyncError(error, context, hooks);

/**
 * Chains post-method lifecycle hooks (onReturn, onError, finally) onto a
 * Promise returned by the original method or by the async onInvoke path.
 *
 * Uses try/catch/finally with await so that:
 * - onReturn is awaited (supports async onReturn hooks)
 * - async onError throws are properly caught and still trigger finally
 * - finally runs exactly once regardless of outcome
 */
const chainAsyncHooks = <R>(
  promise: Promise<R>,
  context: HookContext,
  hooks: EffectHooks<R>,
): Promise<R> => {
  let chained = promise;

  if (hooks.onReturn) {
    chained = chained.then((value) => hooks.onReturn!({ ...context, result: value }));
  }

  if (hooks.onError) {
    chained = chained.catch(
      (error: unknown) => hooks.onError!({ ...context, error }),
    );
  }

  // Always attach finally so it runs after success, onReturn errors,
  // method errors, and onError recovery/re-throws — exactly once.
  if (hooks.finally) {
    chained = chained.finally(() => runFinally(hooks, context));
  }

  return chained;
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
 * Copies the `_symMeta` Map from the original function to a new function.
 *
 * When `EffectOnMethod` replaces `descriptor.value` with a wrapper,
 * any metadata previously set on the original function (e.g. via `@SetMeta`
 * or `@NoLog`) must survive on the new wrapper so downstream consumers
 * (like `EffectOnClass`) can still read it.
 */
const copySymMeta = (source: Function, target: Function): void => {
  const sourceRecord = source as unknown as Record<string, unknown>;
  const sourceMap = sourceRecord[SYM_META_PROP] as Map<symbol, unknown> | undefined;

  if (!sourceMap || sourceMap.size === 0) {
    return;
  }

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