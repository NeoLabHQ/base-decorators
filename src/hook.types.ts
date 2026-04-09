/** Pre-built args object mapping parameter names to their values. */
export type HookArgs = Record<string, unknown> | undefined;

/**
 * Decoration-time context available to every wrapper factory.
 *
 * Contains only the fields known at decoration time. Runtime fields
 * (target, className) and per-call argument data are provided
 * separately via {@link InvocationContext} and {@link HookContext}.
 */
export interface WrapContext {
  /** The property key of the decorated method. */
  propertyKey: string | symbol;
  /** Parameter names extracted from the original function signature. */
  parameterNames: string[];
  /** The property descriptor of the decorated method. */
  descriptor: PropertyDescriptor;
}

/**
 * Per-call context passed to the inner function returned by a {@link WrapFn}.
 *
 * Extends {@link WrapContext} with runtime fields that change on each
 * invocation: the `this` target, the derived class name, and the
 * raw/mapped arguments.
 */
export interface InvocationContext extends WrapContext {
  /** The `this` target object (class instance). */
  target: object;
  /** Runtime class name derived from `this.constructor.name`. */
  className: string;
  /** Raw arguments array passed to the method. */
  args: unknown[];
  /** Pre-built args object mapping parameter names to their values. */
  argsObject: HookArgs;
}

/**
 * Factory function accepted by the Wrap decorator.
 *
 * Called **once at decoration time** with a {@link WrapContext}. Returns an
 * inner function that is called on every invocation with an
 * {@link InvocationContext} and the `this`-bound original method.
 *
 * @typeParam R - The return type produced by the inner function
 */
export type WrapFn<R = unknown> = (
  context: WrapContext,
) => (context: InvocationContext, method: (...args: unknown[]) => unknown) => R;

/**
 * Shared context passed to every lifecycle hook.
 *
 * Equivalent to {@link InvocationContext} which already includes all
 * {@link WrapContext} fields plus per-call runtime data.
 */
export interface HookContext extends InvocationContext {}

/** Extracts the resolved type from a Promise, or returns the type itself. */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/** Allows a Promise return only when the original type is already a Promise. */
export type MaybeAsync<T> = T extends Promise<infer U> ? U | Promise<U> : T;

/** Context for the onReturn hook, adding the method result. */
export interface OnReturnContext<R = unknown> extends HookContext {
  /** The value returned by the original method (unwrapped if it was a Promise). */
  result: UnwrapPromise<R>;
}

/** Context for the onError hook, adding the thrown error. */
export interface OnErrorContext extends HookContext {
  /** The error thrown by the original method. */
  error: unknown;
}

/**
 * Hook fired before the original method executes.
 * @typeParam R - The return type of the decorated method. When it extends Promise,
 *                 the hook may also return a Promise.
 */
export type OnInvokeHookType<R = unknown> = (
  context: HookContext,
) => R extends Promise<unknown> ? void | Promise<void> : void;

/**
 * Hook fired after a successful return. Its return value replaces the method result.
 * @typeParam R - The return type of the decorated method. When it extends Promise,
 *                 the hook may also return a Promise of the resolved type.
 */
export type OnReturnHookType<R = unknown> = (
  context: OnReturnContext<R>,
) => MaybeAsync<R>;

/**
 * Hook fired when the method throws. May return a recovery value or re-throw.
 * @typeParam R - The return type of the decorated method. When it extends Promise,
 *                 the hook may also return a Promise of the resolved type.
 */
export type OnErrorHookType<R = unknown> = (
  context: OnErrorContext,
) => MaybeAsync<R>;

/**
 * Hook fired after both success and error paths, regardless of outcome.
 * @typeParam R - The return type of the decorated method. When it extends Promise,
 *                 the hook may also return a Promise.
 */
export type FinallyHookType<R = unknown> = (
  context: HookContext,
) => R extends Promise<unknown> ? void | Promise<void> : void;

/**
 * Lifecycle hooks for method decoration via Effect-based decorators.
 *
 * Each hook receives a context object containing the pre-built args,
 * `this` target, property key, descriptor, parameter names, and class
 * name. Hooks are optional -- omitting a hook simply skips that
 * lifecycle point.
 *
 * @typeParam R - The return type of the decorated method
 */
export interface EffectHooks<R = unknown> {
  /** Fires before the original method executes. */
  onInvoke?: OnInvokeHookType<R>;

  /** Fires after a successful return. Its return value replaces the method result. */
  onReturn?: OnReturnHookType<R>;

  /** Fires when the method throws. May return a recovery value or re-throw. */
  onError?: OnErrorHookType<R>;

  /** Fires after both success and error paths, regardless of outcome. */
  finally?: FinallyHookType<R>;
}

/**
 * Accepts either a static hooks object or a factory function that
 * produces hooks from the decoration-time context.
 *
 * When a factory is provided, it is called **once at decoration time**
 * with the {@link WrapContext}. The resolved hooks are reused for
 * every subsequent call.
 *
 * @typeParam R - The return type of the decorated method
 */
export type HooksOrFactory<R = unknown> =
  | EffectHooks<R>
  | ((context: WrapContext) => EffectHooks<R>);
