import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import { getParameterNames } from './getParameterNames';
import type { WrapFn, WrapContext, TypedMethodDecorator } from './hook.types';

/**
 * Symbol sentinel set on every function wrapped by {@link WrapOnMethod}.
 *
 * Used by `WrapOnClass` to detect methods that have already been wrapped
 * at the method level, preventing double-wrapping when both class-level
 * and method-level decorators are applied.
 */
export const WRAP_KEY: unique symbol = Symbol('wrap');


/**
 * Core method decorator factory that wraps `descriptor.value` using a
 * user-provided {@link WrapFn} factory.
 *
 * Internally delegates to {@link wrapMethod} for the per-call wrapping
 * logic. After wrapping, the exclusion key sentinel is set on the
 * descriptor via `setMeta`, and any existing `_symMeta` metadata from
 * the original function is copied to the wrapper.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param wrapFn       - Factory called once on first invocation with the
 *                        `this`-bound original method and a
 *                        {@link WrapContext}. Returns the inner function
 *                        that receives raw args on each call.
 * @param exclusionKey - Optional symbol used to mark the wrapped method. When
 *                        provided, this key is set instead of the default
 *                        {@link WRAP_KEY}. This allows different
 *                        Wrap-based decorators to use independent markers that
 *                        do not interfere with each other during class-level
 *                        decoration.
 * @returns A standard `MethodDecorator`
 *
 * @example
 * ```ts
 * class Service {
 *   \@WrapOnMethod((method, ctx) => (...args) => {
 *     console.log(`${String(ctx.propertyKey)} called with`, args);
 *     return method(...args);
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const WrapOnMethod = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  wrapFn: WrapFn<T, TArgs, TReturn>,
  exclusionKey: symbol = WRAP_KEY,
): TypedMethodDecorator<TArgs, TReturn> => {
  return (_target,propertyKey,descriptor) => {
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      throw new Error('Method decorator can only be applied to methods');
    }

    // Extract parameter names at decoration time (once, not per-call)
    const parameterNames = getParameterNames(originalMethod);

    const wrapped = wrapMethod(originalMethod, wrapFn, {
      parameterNames,
      propertyKey,
      descriptor,
    });

    copySymMeta(originalMethod, wrapped);

    descriptor.value = wrapped;

    setMeta(exclusionKey, true, descriptor);

    return descriptor;
  };
};


/**
 * Options describing the method being wrapped by {@link wrapMethod}.
 *
 * Groups the decoration-time metadata that {@link wrapMethod} needs
 * to build a {@link WrapContext} on every invocation.
 */
export interface WrapMethodOptions {
  /** Parameter names extracted from the original function signature. */
  parameterNames: string[];
  /** The property key of the method being wrapped. */
  propertyKey: string | symbol;
  /** The property descriptor of the method being wrapped. */
  descriptor: PropertyDescriptor;
}

/**
 * Derives the class name from an object's constructor, returning an
 * empty string when the constructor lacks a `name` property.
 */
const getClassName = (instance: object): string => {
  const ctor = instance.constructor;

  return ctor?.name ?? '';
};

/**
 * Wraps a plain method with a {@link WrapFn} factory, producing a new
 * function that delegates to the factory-returned inner function on
 * every call.
 *
 * This is the standalone (non-decorator) counterpart of {@link WrapOnMethod}.
 * It can be used directly to wrap any function without relying on the
 * decorator syntax.
 *
 * The {@link WrapFn} factory is called **once on first invocation** with
 * a method proxy and a {@link WrapContext}. On each subsequent call, the
 * cached inner function is invoked with raw arguments.
 *
 * The method proxy always delegates to the original method bound to the
 * current `this` context (set before each call). The {@link WrapContext}
 * is mutable -- `target` and `className` update before each call so the
 * factory's closure always sees current values.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 * @param originalMethod - The function to wrap
 * @param wrapFn         - Factory called once on first invocation with a
 *                          method proxy and {@link WrapContext}. Returns the
 *                          inner function that receives raw args on each call.
 * @param options        - Decoration-time metadata for the method being wrapped
 * @returns A function that, when called, delegates to the cached inner function
 *
 * @example
 * ```ts
 * const wrapped = wrapMethod(originalFn, (method, ctx) => (...args) => {
 *   console.log(`${String(ctx.propertyKey)} called`);
 *   return method(...args);
 * }, {
 *   parameterNames: ['a', 'b'],
 *   propertyKey: 'add',
 *   descriptor,
 * });
 * const result = wrapped.call(instance, 1, 2);
 * ```
 */
export const wrapMethod = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  originalMethod: (...args: TArgs) => TReturn,
  wrapFn: WrapFn<T, TArgs, TReturn>,
  options: WrapMethodOptions,
): ((this: T, ...args: TArgs) => TReturn) => {
  const { parameterNames, propertyKey, descriptor } = options;

  let invocationFn: ((...args: TArgs) => TReturn) | null = null;
  let currentInstance: object;

  /** Method proxy that always delegates to current this. */
  const methodProxy = function (...args: TArgs) {
    return originalMethod.apply(currentInstance, args);
  };

  /** Mutable context -- target/className updated on each call. */
  const wrapContext: WrapContext<T> = {
    propertyKey,
    parameterNames,
    descriptor,
    target: Object.create(null),
    className: '',
  };

  return function (this: T, ...args: TArgs): TReturn {
    currentInstance = this;
    wrapContext.target = this;
    wrapContext.className = getClassName(this);

    if (!invocationFn) {
      invocationFn = wrapFn(methodProxy, wrapContext);
    }

    return invocationFn(...args);
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
