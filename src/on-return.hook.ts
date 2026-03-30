import { Effect } from './effect.decorator';
import type { OnReturnHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` after the decorated method
 * returns successfully. The callback's return value replaces the method
 * result, enabling post-processing or result transformation.
 *
 * @typeParam R - The return type of the decorated method
 * @param callback - Function called after successful return\
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `EFFECT_APPLIED_KEY`.
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
export const OnReturnHook = <R = unknown>(
  callback: OnReturnHookType<R>,
  exclusionKey?: symbol
): ClassDecorator & MethodDecorator => {
  return Effect<R>({ onReturn: callback }, exclusionKey);
};
