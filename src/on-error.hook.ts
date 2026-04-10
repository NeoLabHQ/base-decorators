import { Effect } from './effect.decorator';
import type { OnErrorHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` when the decorated method
 * throws an error. The callback may return a recovery value or re-throw
 * the error to propagate it.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param callback - Function called when the method throws
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `WRAP_KEY`.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@OnErrorHook(({ propertyKey, error }) => {
 *     console.error(propertyKey, 'failed:', error);
 *     throw error; // re-throw after logging
 *   })
 *   riskyOperation() { throw new Error('oops'); }
 * }
 * ```
 */
export const OnErrorHook = <
T extends object = object,
TArgs extends unknown[] = unknown[],
TReturn = unknown,
>(
  callback: OnErrorHookType<T, TArgs, TReturn>,
  exclusionKey?: symbol
) => {
  return Effect<T, TArgs, TReturn>({ onError: callback }, exclusionKey);
};
