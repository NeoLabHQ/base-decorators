import { WrapOnClass } from './wrap-on-class';
import { WrapOnMethod } from './wrap-on-method';
import type { WrapFn } from './hook.types';

/**
 * Creates a decorator that can be applied to either a class or a method.
 *
 * When applied to a **class** (receives 1 argument -- the constructor),
 * delegates to {@link WrapOnClass} which wraps every eligible prototype
 * method with the provided wrapper function, skipping methods already
 * marked with `WRAP_APPLIED_KEY` or `exclusionKey`.
 *
 * When applied to a **method** (receives 3 arguments -- target, propertyKey,
 * descriptor), delegates to {@link WrapOnMethod} which wraps that single
 * method with the provided wrapper function and marks it with `exclusionKey`
 * (or `WRAP_APPLIED_KEY` if none provided) to prevent double-wrapping
 * by a class-level decorator.
 *
 * Throws an `Error` if invoked in any other context (e.g. `propertyKey` is
 * present but `descriptor` is `undefined`).
 *
 * @typeParam R - The return type expected from the wrapper function
 * @param wrapFn       - Factory called per invocation with the `this`-bound
 *                        original method and a {@link WrapContext}. Returns the
 *                        replacement function that receives the actual arguments.
 * @param exclusionKey - Optional symbol used to mark the wrapped method. When
 *                        provided, this key is set instead of the default
 *                        `WRAP_APPLIED_KEY`. This allows different
 *                        Wrap-based decorators (e.g. `@Log`, `@Timer`) to
 *                        use independent markers that do not interfere with
 *                        each other during class-level decoration.
 * @returns A decorator usable on both classes and methods
 *
 * @example
 * ```ts
 * // Method-level usage
 * class Service {
 *   \@Wrap((method, ctx) => (...args) => {
 *     console.log(`${ctx.className}.${String(ctx.propertyKey)} called`);
 *     return method(...args);
 *   })
 *   doWork() { return 42; }
 * }
 *
 * // Class-level usage
 * \@Wrap((method, ctx) => (...args) => {
 *   console.log(`${String(ctx.propertyKey)} called`);
 *   return method(...args);
 * })
 * class AnotherService {
 *   methodA() { return 'a'; }
 *   methodB() { return 'b'; }
 * }
 * ```
 */
export const Wrap = <R = unknown>(
  wrapFn: WrapFn<R>,
  exclusionKey?: symbol,
): ClassDecorator & MethodDecorator => {
  const classDecorator = WrapOnClass<R>(wrapFn, exclusionKey);
  const methodDecorator = WrapOnMethod<R>(wrapFn, exclusionKey);

  return ((
    target: Function | object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): Function | PropertyDescriptor | void => {
    // Class decorator: receives 1 argument (the constructor)
    if (propertyKey === undefined) {
      classDecorator(target as Function);
      return target as Function;
    }

    // Method decorator: receives 3 arguments (target, propertyKey, descriptor)
    if (descriptor !== undefined) {
      return methodDecorator(target, propertyKey, descriptor);
    }

    throw new Error(
      'Wrap decorator can only be applied to classes or methods',
    );
  }) as ClassDecorator & MethodDecorator;
};
