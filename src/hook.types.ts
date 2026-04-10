/** Pre-built args object mapping parameter names to their values. */
export type HookArgs = Record<string, unknown> | undefined;

/**
 * Context available to every wrapper factory.
 *
 * Contains decoration-time fields (propertyKey, parameterNames, descriptor)
 * plus mutable runtime fields (target, className) that update before each
 * method invocation. The factory receives this context on first call and
 * retains a reference; target/className always reflect the current caller.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export interface WrapContext<
  T extends object = object
> {
  /** The property key of the decorated method. */
  propertyKey: string | symbol;
  /** Parameter names extracted from the original function signature. */
  parameterNames: string[];
  /** The property descriptor of the decorated method. */
  descriptor: PropertyDescriptor;
  /** The `this` target object (class instance). Updated before each call. */
  target: T;
  /** Runtime class name derived from `this.constructor.name`. Updated before each call. */
  className: string;
}

/**
 * Factory function accepted by the Wrap decorator.
 *
 * Called **once on first method invocation** with the `this`-bound
 * original method and a {@link WrapContext}. Returns an inner function
 * that is called on every invocation with the raw arguments.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type and the inner function return type. Defaults to `unknown`.
 */
export type WrapFn<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (
  method: (...args: TArgs) => TReturn,
  context: WrapContext<T>,
) => (...args: TArgs) => TReturn;

/**
 * Shared context passed to every lifecycle hook.
 *
 * Extends {@link WrapContext} with per-call argument data.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export interface HookContext<
  T extends object = object,
  TArgs extends unknown[] = unknown[]
> extends WrapContext<T> {
  /** Raw arguments array passed to the method. */
  args: TArgs;
  /** Pre-built args object mapping parameter names to their values. */
  argsObject: HookArgs; // TODO: add type inferetence HookArgs<TArgs>
}

/**
 * A method decorator signature that uses `TypedPropertyDescriptor` to
 * enable TypeScript to infer `TArgs` and `TReturn` from the decoration site.
 *
 * When TypeScript sees this decorator applied to a method, it matches the
 * method's parameter types and return type against `TArgs` and `TReturn`,
 * preserving the method's original type through decoration.
 */
export type TypedMethodDecorator<TArgs extends unknown[], TReturn> = (
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<(...args: TArgs) => TReturn>,
) => TypedPropertyDescriptor<(...args: TArgs) => TReturn> | void;

/** Extracts the resolved type from a Promise, or returns the type itself. */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/** Allows a Promise return only when the original type is already a Promise. */
export type MaybeAsync<T> = T extends Promise<infer U> ? U | Promise<U> : T;

/**
 * Context for the onReturn hook, adding the method result.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export interface OnReturnContext<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> extends HookContext<T, TArgs> {
  /** The value returned by the original method (unwrapped if it was a Promise). */
  result: UnwrapPromise<TReturn>;
}

/**
 * Context for the onError hook, adding the thrown error.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export interface OnErrorContext<
  T extends object = object,
  TArgs extends unknown[] = unknown[]
> extends HookContext<T, TArgs> {
  /** The error thrown by the original method. */
  error: unknown;
}

/**
 * Hook fired before the original method executes.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The return type of the decorated method. When it extends Promise,
 *                      the hook may also return a Promise. Defaults to `unknown`.
 */
export type OnInvokeHookType<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (
  context: HookContext<T, TArgs>,
) => TReturn extends Promise<unknown> ? void | Promise<void> : void;

/**
 * Hook fired after a successful return. Its return value replaces the method result.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export type OnReturnHookType<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (
  context: OnReturnContext<T, TArgs, TReturn>,
) => MaybeAsync<TReturn>;

/**
 * Hook fired when the method throws. May return a recovery value or re-throw.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export type OnErrorHookType<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (
  context: OnErrorContext<T, TArgs>,
) => MaybeAsync<TReturn>;

/**
 * Hook fired after both success and error paths, regardless of outcome.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export type FinallyHookType<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> = (
  context: HookContext<T, TArgs>,
) => TReturn extends Promise<unknown> ? void | Promise<void> : void;

/**
 * Lifecycle hooks for method decoration via Effect-based decorators.
 *
 * Each hook receives a context object containing the pre-built args,
 * `this` target, property key, descriptor, parameter names, and class
 * name. Hooks are optional -- omitting a hook simply skips that
 * lifecycle point.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export interface EffectHooks<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> {
  /** Fires before the original method executes. */
  onInvoke?: OnInvokeHookType<T, TArgs, TReturn>;

  /** Fires after a successful return. Its return value replaces the method result. */
  onReturn?: OnReturnHookType<T, TArgs, TReturn>;

  /** Fires when the method throws. May return a recovery value or re-throw. */
  onError?: OnErrorHookType<T, TArgs, TReturn>;

  /** Fires after both success and error paths, regardless of outcome. */
  finally?: FinallyHookType<T, TArgs, TReturn>;
}

/**
 * Accepts either a static hooks object or a factory function that
 * produces hooks from the decoration-time context.
 *
 * When a factory is provided, it is called **once on first invocation**
 * with the {@link WrapContext}. The resolved hooks are reused for
 * every subsequent call.
 *
 * @typeParam T      - The class instance type. Defaults to `object`.
 * @typeParam TArgs  - Tuple of method parameter types. Defaults to `unknown[]`.
 * @typeParam TReturn - The method return type. Defaults to `unknown`.
 */
export type HooksOrFactory<
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
> =
  | EffectHooks<T, TArgs, TReturn>
  | ((context: WrapContext<T>) => EffectHooks<T, TArgs, TReturn>);
