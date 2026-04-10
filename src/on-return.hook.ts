import { Effect } from './effect.decorator';
import type { OnReturnHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` after the decorated method
 * returns successfully. The callback's return value replaces the method
 * result, enabling post-processing or result transformation.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param callback - Function called after successful return
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `WRAP_KEY`.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@OnReturnHook(({ propertyKey, result }) => {
 *     console.log(propertyKey, 'returned', result);
 *     return result;
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const OnReturnHook = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  callback: OnReturnHookType<T, TArgs, TReturn>,
  exclusionKey?: symbol
) => {
  return Effect<T, TArgs, TReturn>({ onReturn: callback }, exclusionKey);
};
