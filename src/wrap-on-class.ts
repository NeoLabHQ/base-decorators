/**
 * Class-level decorator that applies a {@link WrapFn} to all prototype methods.
 *
 * Iterates `Object.getOwnPropertyNames(target.prototype)`, skipping the
 * constructor, non-function values, getters/setters, methods already wrapped
 * by {@link WrapOnMethod} (detected via {@link WRAP_KEY}), and
 * methods excluded via an optional `exclusionKey` symbol.
 *
 * @module wrap-on-class
 */

import { getMeta } from './set-meta.decorator';
import type { WrapFn } from './hook.types';
import { WrapOnMethod, WRAP_KEY } from './wrap-on-method';

/**
 * Class decorator factory that wraps every eligible prototype method with
 * a user-provided {@link WrapFn} via {@link WrapOnMethod}.
 *
 * Skipped members:
 * - `constructor`
 * - Non-function prototype values
 * - Getters and setters (only plain `descriptor.value` functions are wrapped)
 * - Methods marked with `exclusionKey` metadata (double-wrap prevention and
 *   explicit exclusion via e.g. `@SetMeta(key, true)`)
 *
 * @typeParam R - The return type expected from the wrapped methods
 * @param wrapFn       - Factory forwarded to {@link WrapOnMethod} for each
 *                        eligible method
 * @param exclusionKey - Symbol used to detect already-decorated and excluded
 *                       methods. Defaults to {@link WRAP_KEY}. Pass a
 *                       custom symbol to isolate this decorator from other
 *                       Wrap-based decorators.
 * @returns A standard `ClassDecorator`
 *
 * @example
 * ```ts
 * const LOG_KEY = Symbol('log');
 *
 * \@WrapOnClass((method, ctx) => (...args) => {
 *   console.log(`${ctx.className}.${String(ctx.propertyKey)} called`);
 *   return method(...args);
 * }, LOG_KEY)
 * class Service {
 *   doWork() { return 42; }
 *
 *   \@SetMeta(LOG_KEY, true)
 *   internal() { return 'skipped'; }
 * }
 * ```
 */
export const WrapOnClass = <R = unknown>(
  wrapFn: WrapFn<R>,
  exclusionKey: symbol = WRAP_KEY,
): ClassDecorator => {
  const methodDecorator = WrapOnMethod(wrapFn, exclusionKey);

  return (target: Function): void => {
    const prototype = target.prototype as Record<string, unknown>;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (
        !descriptor
        || !isPlainMethod(descriptor)
        || shouldSkipMethod(descriptor, exclusionKey)
      ) {
        continue;
      }

      methodDecorator(prototype as object, propertyName, descriptor);
      Object.defineProperty(prototype, propertyName, descriptor);
    }
  };
};

/**
 * Determines whether a property descriptor represents a plain method.
 *
 * Returns `false` for getters, setters, and non-function values so that
 * only callable `descriptor.value` entries are considered for wrapping.
 */
const isPlainMethod = (descriptor: PropertyDescriptor): boolean => {
  if (descriptor.get || descriptor.set) return false;
  return typeof descriptor.value === 'function';
};

/**
 * Determines whether a method should be skipped by the class decorator.
 *
 * Uses the provided `exclusionKey` to check for metadata on the method.
 * When `WrapOnMethod` wraps a method it marks it with the same key,
 * so this single check handles both double-wrap prevention (method already
 * decorated by this decorator type) and explicit exclusion (e.g. `@SetMeta(key, true)`).
 */
const shouldSkipMethod = (
  descriptor: PropertyDescriptor,
  exclusionKey: symbol,
): boolean => {
  return getMeta(exclusionKey, descriptor) === true;
};
