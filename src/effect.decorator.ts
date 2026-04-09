import { Wrap } from './wrap.decorator';
import type {
  EffectHooks,
  HookContext,
  HooksOrFactory,
  UnwrapPromise,
  WrapContext,
  WrapFn,
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
 *                       function that receives a {@link HookContext} and
 *                       returns hooks. The factory is called once per
 *                       method invocation, before any hooks fire.
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
  Wrap((
    boundMethod: (...args: unknown[]) => unknown,
    wrapContext: WrapContext,
  ) => {
    return (...args: unknown[]): unknown => {
      const argsObject = buildArgsObject(wrapContext.parameterNames, args);

      const hookContext: HookContext = { ...wrapContext, args, argsObject };

      const resolvedHooks = resolveHooks(hooks, hookContext);

      const executeMethod = attachHooks(
        boundMethod,
        wrapContext.target,
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
 * Returns a thunk that runs the original method and applies sync/async lifecycle hooks.
 *
 * Kept as a thunk so async `onInvoke` can defer execution via `.then()`.
 * `finally` is applied inline on sync paths to avoid double-calling when
 * `onReturn` or `onError` throw.
 */
const attachHooks = <R>(
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
