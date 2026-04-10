import { Wrap } from './wrap.decorator';
import type {
  EffectHooks,
  HookContext,
  HooksOrFactory,
  UnwrapPromise,
  WrapContext,
} from './hook.types';

/**
 * Creates a decorator that can be applied to either a class or a method.
 *
 * Internally constructs an `effectWrapFn` that implements lifecycle hooks
 * (onInvoke, onReturn, onError, finally) and delegates all class/method
 * dispatch logic to {@link Wrap}.
 *
 * When applied to a **class**, wraps every eligible prototype method with
 * the provided lifecycle hooks (via Wrap -> WrapOnClass).
 *
 * When applied to a **method**, wraps that single method with the provided
 * lifecycle hooks (via Wrap -> WrapOnMethod).
 *
 * @typeParam R - The return type expected from lifecycle hooks
 * @param hooks        - Lifecycle callbacks (all optional) or a factory
 *                       function that receives a {@link WrapContext} and
 *                       returns hooks. The factory is called **once on
 *                       first invocation**. The resolved hooks are reused
 *                       for every subsequent call.
 * @param exclusionKey - Optional symbol used to mark the wrapped method. When
 *                       provided, this key is set instead of the default
 *                       `WRAP_APPLIED_KEY`. This allows different
 *                       Effect-based decorators (e.g. `@Log`, `@Metrics`) to
 *                       use independent markers that do not interfere with
 *                       each other during class-level decoration.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * // Method-level usage
 * class Service {
 *   \@Effect({ onReturn: ({ propertyKey, result }) => { console.log(propertyKey); return result; } })
 *   doWork() { return 42; }
 * }
 *
 * // Class-level usage
 * \@Effect({ onInvoke: ({ propertyKey }) => console.log('called', propertyKey) })
 * class AnotherService {
 *   methodA() { return 'a'; }
 *   methodB() { return 'b'; }
 * }
 * ```
 */
export const Effect = <R = unknown>(
  hooks: HooksOrFactory<R>,
  exclusionKey?: symbol,
): ClassDecorator & MethodDecorator =>
  Wrap((method: (...args: unknown[]) => unknown, wrapContext: WrapContext) => {
    const resolvedHooks = resolveHooks(hooks, wrapContext);

    return (...args: unknown[]): unknown => {
      const argsObject = buildArgsObject(wrapContext.parameterNames, args);
      const hookContext: HookContext = { ...wrapContext, args, argsObject };

      const executeMethod = attachHooks(
        method,
        args,
        hookContext,
        resolvedHooks,
      );

      if (resolvedHooks.onInvoke) {
        const invokeResult = resolvedHooks.onInvoke(hookContext);

        if (invokeResult instanceof Promise) {
          return invokeResult.then(executeMethod);
        }
      }

      return executeMethod();
    };
  }, exclusionKey);

/**
 * Builds an object mapping parameter names to their call-time values.
 *
 * Creates a record where keys are parameter names and values are the
 * corresponding argument values passed to the function. Returns
 * `undefined` when both arrays are empty.
 *
 * @param parameterNames - Array of parameter names from the function signature
 * @param args - Array of argument values from the current invocation
 * @returns Object mapping parameter names to values, or undefined when empty
 *
 * @example
 * buildArgsObject(['id', 'name'], [1, 'John'])
 * // Returns: { id: 1, name: 'John' }
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
 * Returns a thunk that runs the bound method and applies sync/async lifecycle hooks.
 *
 * Kept as a thunk so async `onInvoke` can defer execution via `.then()`.
 * `finally` is applied inline on sync paths to avoid double-calling when
 * `onReturn` or `onError` throw.
 */
const attachHooks = <R>(
  method: (...args: unknown[]) => unknown,
  args: unknown[],
  context: HookContext,
  hooks: EffectHooks<R>,
): (() => unknown) => () => {
  try {
    const result = method(...args);

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
 * Resolves hooks from a static object or factory function.
 *
 * When `hooksOrFactory` is a function, it is called with the provided
 * context to produce the hooks. Otherwise, the static hooks are returned
 * as-is.
 */
const resolveHooks = <R>(
  hooksOrFactory: HooksOrFactory<R>,
  context: WrapContext,
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
