import { WrapOnClass } from './wrap-on-class';
import { WrapOnMethod } from './wrap-on-method';
import type { WrapFn, TypedMethodDecorator } from './hook.types';

/**
 * Creates a decorator that can be applied to either a class or a method.
 *
 * When applied to a **class** (receives 1 argument -- the constructor),
 * delegates to {@link WrapOnClass} which wraps every eligible prototype
 * method with the provided wrapper function, skipping methods already
 * marked with `WRAP_KEY` or `exclusionKey`.
 *
 * When applied to a **method** (receives 3 arguments -- target, propertyKey,
 * descriptor), delegates to {@link WrapOnMethod} which wraps that single
 * method with the provided wrapper function and marks it with `exclusionKey`
 * (or `WRAP_KEY` if none provided) to prevent double-wrapping
 * by a class-level decorator.
 *
 * Throws an `Error` if invoked in any other context (e.g. `propertyKey` is
 * present but `descriptor` is `undefined`).
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
 *                        `WRAP_KEY`. This allows different
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
export const Wrap = <
  T extends object = object,
  TArgs extends unknown[] = unknown[],
  TReturn = unknown,
>(
  wrapFn: WrapFn<T, TArgs, TReturn>,
  exclusionKey?: symbol,
): ClassDecorator & TypedMethodDecorator<TArgs, TReturn> => {
  const classDecorator = WrapOnClass<T, TArgs, TReturn>(wrapFn, exclusionKey);
  const methodDecorator = WrapOnMethod<T, TArgs, TReturn>(wrapFn, exclusionKey);

  return ((
    target: Function | object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): Function | PropertyDescriptor | void => {
    // Class decorator: receives 1 argument (the constructor)
    if (propertyKey === undefined) {
      if (typeof target === 'function') {
        classDecorator(target);
        return target;
      }

      throw new Error(
        'Wrap decorator can only be applied to classes or methods',
      );
    }

    // Method decorator: receives 3 arguments (target, propertyKey, descriptor)
    if (descriptor !== undefined) {
      return methodDecorator(target, propertyKey, descriptor);
    }

    throw new Error(
      'Wrap decorator can only be applied to classes or methods',
    );
  }) as ClassDecorator & TypedMethodDecorator<TArgs, TReturn>;
};
