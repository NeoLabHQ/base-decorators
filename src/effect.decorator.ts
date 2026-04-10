import { Wrap } from './wrap.decorator';
import type {
  EffectHooks,
  HookContext,
  HooksOrFactory,
  TypedMethodDecorator,
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
 * @param hooks        - Lifecycle callbacks (all optional) or a factory
 *                       function that receives a {@link WrapContext} and
 *                       returns hooks. The factory is called **once on
 *                       first invocation**. The resolved hooks are reused
 *                       for every subsequent call.
 * @param exclusionKey - Optional symbol used to mark the wrapped method. When
 *                       provided, this key is set instead of the default
 *                       `WRAP_KEY`. This allows different
 *                       Effect-based decorators (e.g. `@Log`, `@Metrics`) to
 *                       use independent markers that do not interfere with
 *                       each other during class-level decoration.
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
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
export const Effect = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  hooks: HooksOrFactory<T, TArgs, TReturn>,
  exclusionKey?: symbol,
): ClassDecorator & TypedMethodDecorator<TArgs, TReturn> =>
  Wrap<T, TArgs, TReturn>((method, wrapContext) => {
    const resolvedHooks = resolveHooks<T, TArgs, TReturn>(hooks, wrapContext);

    return (...args: TArgs): TReturn => {
      const argsObject = buildArgsObject(wrapContext.parameterNames, args);
      const hookContext: HookContext<T, TArgs> = { ...wrapContext, args, argsObject };

      const executeMethod = attachHooks<T, TArgs, TReturn>(
        method,
        args,
        hookContext,
        resolvedHooks,
      );

      if (resolvedHooks.onInvoke) {
        const invokeResult = resolvedHooks.onInvoke(hookContext);

        if (invokeResult instanceof Promise) {
          return invokeResult.then(executeMethod) as TReturn;
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
const attachHooks = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  method: (...args: TArgs) => TReturn,
  args: TArgs,
  context: HookContext<T, TArgs>,
  hooks: EffectHooks<T, TArgs, TReturn>,
): (() => TReturn) => (): TReturn => {
  try {
    const result = method(...args);

    if (result instanceof Promise) {
      return chainAsyncHooks(result, context, hooks) as TReturn;
    }

    try {
      return hooks.onReturn
        ? hooks.onReturn({ ...context, result: result as UnwrapPromise<TReturn> }) as TReturn
        : result;
    } finally {
      hooks.finally?.(context);
    }
  } catch (error: unknown) {
    try {
      if (hooks.onError) {
        return hooks.onError({ ...context, error }) as TReturn;
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
const resolveHooks = <
T extends object = object,
TArgs extends unknown[] = unknown[],
TReturn = unknown,
>(
  hooksOrFactory: HooksOrFactory<T, TArgs, TReturn>,
  context: WrapContext<T>,
): EffectHooks<T, TArgs, TReturn> => {
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
const chainAsyncHooks = async <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  promise: Promise<UnwrapPromise<TReturn>>,
  context: HookContext<T, TArgs>,
  hooks: EffectHooks<T, TArgs, TReturn>,
): Promise<UnwrapPromise<TReturn>> => {
  try {
    const value = await promise;

    return hooks.onReturn
      ? await hooks.onReturn({ ...context, result: value }) as UnwrapPromise<TReturn>
      : value;
  } catch (error: unknown) {
    if (hooks.onError) {
      return await hooks.onError({ ...context, error }) as UnwrapPromise<TReturn>;
    }

    throw error;
  } finally {
    if (hooks.finally) {
      await hooks.finally(context);
    }
  }
};
