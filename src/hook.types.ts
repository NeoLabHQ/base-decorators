/** Pre-built args object mapping parameter names to their values. */
export type HookArgs = Record<string, unknown> | undefined;

/**
 * Decoration-time and runtime context available to every wrapper.
 *
 * Contains the fields that are known at decoration time (propertyKey,
 * parameterNames, descriptor) plus fields resolved at runtime (target,
 * className). Does NOT include per-call argument data -- that is added
 * by {@link HookContext} for lifecycle-hook consumers.
 */
export interface WrapContext {
  /** The `this` target object (class instance). */
  target: object;
  /** The property key of the decorated method. */
  propertyKey: string | symbol;
  /** Parameter names extracted from the original function signature. */
  parameterNames: string[];
  /** Runtime class name derived from `this.constructor.name`. */
  className: string;
  /** The property descriptor of the decorated method. */
  descriptor: PropertyDescriptor;
}

/**
 * Factory function accepted by the Wrap decorator.
 *
 * Receives the original (this-bound) method and a {@link WrapContext},
 * and returns a replacement function that is called with the actual
 * arguments at invocation time.
 *
 * @typeParam R - The return type produced by the replacement function
 */
export type WrapFn<R = unknown> = (
  method: (...args: unknown[]) => unknown,
  context: WrapContext,
) => (...args: unknown[]) => R;

/**
 * Shared context passed to every lifecycle hook.
 *
 * Extends {@link WrapContext} with per-call argument data: the raw
 * arguments array and the pre-built args object mapping parameter
 * names to their values.
 */
export interface HookContext extends WrapContext {
  /** Raw arguments array passed to the method. */
  args: unknown[];
  /** Pre-built args object mapping parameter names to their values. */
  argsObject: HookArgs;
}

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
 * produces hooks at runtime from the invocation context.
 *
 * When a factory is provided, it is called once per method invocation
 * inside the wrapper function, before any hooks fire.
 *
 * @typeParam R - The return type of the decorated method
 */
export type HooksOrFactory<R = unknown> =
  | EffectHooks<R>
  | ((context: HookContext) => EffectHooks<R>);
