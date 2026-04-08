import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import { getParameterNames } from './getParameterNames';
import type { WrapFn, WrapContext } from './hook.types';

/**
 * Symbol sentinel set on every function wrapped by {@link WrapOnMethod}.
 *
 * Used by `WrapOnClass` to detect methods that have already been wrapped
 * at the method level, preventing double-wrapping when both class-level
 * and method-level decorators are applied.
 */
export const WRAP_APPLIED_KEY: unique symbol = Symbol('wrapApplied');

/**
 * Core method decorator factory that wraps `descriptor.value` using a
 * user-provided {@link WrapFn} factory.
 *
 * The wrapped function preserves `this` context by binding the original
 * method to the runtime `this` on every invocation. After wrapping, the
 * exclusion key sentinel is set on the descriptor via `setMeta`, and any
 * existing `_symMeta` metadata from the original function is copied to
 * the wrapper.
 *
 * @typeParam R - The return type of the decorated method
 * @param wrapFn       - Factory called per invocation with the `this`-bound
 *                        original method and a {@link WrapContext}. Returns the
 *                        replacement function that receives the actual arguments.
 * @param exclusionKey - Optional symbol used to mark the wrapped method. When
 *                        provided, this key is set instead of the default
 *                        {@link WRAP_APPLIED_KEY}. This allows different
 *                        Wrap-based decorators to use independent markers that
 *                        do not interfere with each other during class-level
 *                        decoration.
 * @returns A standard `MethodDecorator`
 *
 * @example
 * ```ts
 * class Service {
 *   \@WrapOnMethod((method, ctx) => (...args) => {
 *     console.log(`${ctx.className}.${String(ctx.propertyKey)} called`);
 *     return method(...args);
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const WrapOnMethod = <R = unknown>(
  wrapFn: WrapFn<R>,
  exclusionKey: symbol = WRAP_APPLIED_KEY,
): MethodDecorator => {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    // Extract parameter names at decoration time (once, not per-call)
    const parameterNames = getParameterNames(originalMethod);

    const wrapped = function (this: object, ...args: unknown[]): unknown {
      const boundMethod = originalMethod.bind(this);
      const className = (this.constructor as { name: string }).name ?? '';

      const wrapContext: WrapContext = {
        target: this,
        propertyKey,
        parameterNames,
        className,
        descriptor,
      };

      const innerFn = wrapFn(boundMethod, wrapContext);

      return innerFn(...args);
    };

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;

    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};

/**
 * Copies the `_symMeta` Map from the original function to a new function.
 *
 * When `WrapOnMethod` replaces `descriptor.value` with a wrapper,
 * any metadata previously set on the original function (e.g. via `@SetMeta`)
 * must survive on the new wrapper so downstream consumers
 * (like `WrapOnClass`) can still read it.
 */
const copySymMeta = (source: Function, target: Function): void => {
  const sourceRecord = source as unknown as Record<string, unknown>;
  const sourceMap = sourceRecord[SYM_META_PROP] as
    | Map<symbol, unknown>
    | undefined;

  if (!sourceMap || sourceMap.size === 0) return;

  const targetRecord = target as unknown as Record<string, unknown>;

  if (!targetRecord[SYM_META_PROP]) {
    Object.defineProperty(target, SYM_META_PROP, {
      value: new Map<symbol, unknown>(),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  const targetMap = targetRecord[SYM_META_PROP] as Map<symbol, unknown>;
  sourceMap.forEach((value, key) => targetMap.set(key, value));
};
