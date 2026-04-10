import { Effect } from './effect.decorator';
import type { FinallyHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` after every method execution,
 * regardless of outcome. Useful for cleanup, resource release, or metrics
 * finalization that must run whether the method succeeded or failed.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param callback - Function called after every method execution
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `WRAP_KEY`.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * class Service {
 *   \@FinallyHook(({ propertyKey, args }) => console.log(propertyKey, 'completed', args))
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const FinallyHook = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  callback: FinallyHookType<T, TArgs, TReturn>,
  exclusionKey?: symbol
) => {
  return Effect<T, TArgs, TReturn>({ finally: callback }, exclusionKey);
};
