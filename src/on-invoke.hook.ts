import { Effect } from './effect.decorator';
import type { OnInvokeHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` before the decorated method
 * executes. Useful for pre-execution side effects such as tracing, metrics,
 * or input validation logging.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param callback - Function called before each method invocation
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `WRAP_KEY`.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@OnInvokeHook(({ args, propertyKey }) => console.log('calling', propertyKey, args))
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const OnInvokeHook = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  callback: OnInvokeHookType<T, TArgs, TReturn>,
  exclusionKey?: symbol
) => {
  return Effect<T, TArgs, TReturn>({ onInvoke: callback }, exclusionKey);
};
