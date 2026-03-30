import { Effect } from './effect.decorator';
import type { OnErrorHookType } from './hook.types';

/**
 * Creates a decorator that invokes `callback` when the decorated method
 * throws an error. The callback may return a recovery value or re-throw
 * the error to propagate it.
 *
 * @typeParam R - The return type of the decorated method
 * @param callback - Function called when the method throws
 * @param exclusionKey - Optional symbol; Methods carrying this
 *                       metadata are skipped during class-level decoration,
 *                       and method-level decoration marks methods with this
 *                       key instead of the default `EFFECT_APPLIED_KEY`.
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
export const OnErrorHook = <R = unknown>(
  callback: OnErrorHookType<R>,
  exclusionKey?: symbol
): ClassDecorator & MethodDecorator => {
  return Effect<R>({ onError: callback }, exclusionKey);
};
