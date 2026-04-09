import { setMeta, SYM_META_PROP } from './set-meta.decorator';
import { getParameterNames } from './getParameterNames';
import type { WrapFn, WrapContext, InvocationContext } from './hook.types';

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
 * @typeParam R - The return type of the decorated method
 * @param wrapFn       - Factory called once at decoration time with a
 *                        {@link WrapContext}. Returns the inner function that
 *                        receives the `this`-bound original method and an
 *                        {@link InvocationContext} on each call.
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
 *   \@WrapOnMethod((ctx) => (method, invCtx) => {
 *     console.log(`${String(ctx.propertyKey)} called with`, invCtx.args);
 *     return method(...invCtx.args);
 *   })
 *   doWork(input: string) { return input.toUpperCase(); }
 * }
 * ```
 */
export const WrapOnMethod = <R = unknown>(
  wrapFn: WrapFn<R>,
  exclusionKey: symbol = WRAP_KEY,
): MethodDecorator => {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

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
 * Wraps a plain method with a {@link WrapFn} factory, producing a new
 * function that delegates to the factory-returned inner function on
 * every call.
 *
 * This is the standalone (non-decorator) counterpart of {@link WrapOnMethod}.
 * It can be used directly to wrap any function without relying on the
 * decorator syntax.
 *
 * The {@link WrapFn} factory is called **once** (immediately) with the
 * decoration-time {@link WrapContext}. On each invocation, the original
 * method is bound to `this`, an {@link InvocationContext} is built with
 * the current arguments, and both are passed to the inner function.
 *
 * @typeParam R - The return type produced by the wrapper
 * @param originalMethod - The function to wrap
 * @param wrapFn         - Factory called once at wrap time with a
 *                          {@link WrapContext}. Returns the inner function
 *                          that receives the `this`-bound method and an
 *                          {@link InvocationContext} on each call.
 * @param options        - Decoration-time metadata for the method being wrapped
 * @returns A function that, when called, binds the original method, builds
 *          an {@link InvocationContext}, and delegates to the inner function
 *
 * @example
 * ```ts
 * const wrapped = wrapMethod(originalFn, myWrapFn, {
 *   parameterNames: ['a', 'b'],
 *   propertyKey: 'add',
 *   descriptor,
 * });
 * const result = wrapped.call(instance, 1, 2);
 * ```
 */
export const wrapMethod = <R = unknown>(
  originalMethod: (...args: unknown[]) => unknown,
  wrapFn: WrapFn<R>,
  options: WrapMethodOptions,
): ((this: object, ...args: unknown[]) => unknown) => {
  const { parameterNames, propertyKey, descriptor } = options;

  const decorationContext: WrapContext = {
    propertyKey,
    parameterNames,
    descriptor,
  };

  const factoryFn = wrapFn(decorationContext);

  return function (this: object, ...args: unknown[]): unknown {

    const boundMethod = originalMethod.bind(this);

    const className = getClassName(this);
    const argsObject = buildArgsObject(parameterNames, args);

    const invocationContext: InvocationContext = {
      ...decorationContext,
      target: this,
      className,
      args,
      argsObject,
    };

    return factoryFn(boundMethod, invocationContext);
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
