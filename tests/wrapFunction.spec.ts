import { describe, it, expect, vi } from 'vitest';

import { wrapMethod } from '../src/wrap-on-method';
import type { WrapFn, WrapContext } from '../src/hook.types';

/**
 * Helper that simulates how {@link WrapOnMethod} extracts the original
 * method from a descriptor. The cast mirrors `descriptor.value as (...args: unknown[]) => unknown`
 * in `WrapOnMethod`, so we test `wrapFunction` with the same input shape.
 */
const asMethod = (fn: Function): ((...args: unknown[]) => unknown) =>
  fn as (...args: unknown[]) => unknown;

describe('wrapFunction', () => {
  describe('basic wrapping', () => {
    it('should return a function that invokes wrapFn per call', () => {
      const wrapFnSpy = vi.fn<WrapFn>((method, _context) => {
        return (...args: unknown[]) => method(...args);
      });

      function greet(name: string) {
        return `hello ${name}`;
      }

      const original = asMethod(greet);
      const descriptor: PropertyDescriptor = { value: original, writable: true };

      const wrapped = wrapMethod(original, wrapFnSpy, {
        parameterNames: ['name'],
        propertyKey: 'greet',
        descriptor,
      });

      expect(wrapFnSpy).not.toHaveBeenCalled();

      const instance = { constructor: { name: 'TestService' } };
      const result = wrapped.call(instance, 'world');

      expect(result).toBe('hello world');
      expect(wrapFnSpy).toHaveBeenCalledTimes(1);
    });

    it('should invoke wrapFn on every call, not just the first', () => {
      let callCount = 0;

      const wrapFn: WrapFn = (method, _context) => {
        callCount++;
        return (...args: unknown[]) => method(...args);
      };

      function doWork() {
        return 42;
      }

      const original = asMethod(doWork);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'doWork',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };

      expect(callCount).toBe(0);

      wrapped.call(instance);
      expect(callCount).toBe(1);

      wrapped.call(instance);
      expect(callCount).toBe(2);

      wrapped.call(instance);
      expect(callCount).toBe(3);
    });

    it('should return the result from the inner function', () => {
      const wrapFn: WrapFn<number> = (method, _context) => {
        return (...args: unknown[]) => {
          const result = method(...args) as number;
          return result * 2;
        };
      };

      function compute(x: number) {
        return x + 1;
      }

      const original = asMethod(compute);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['x'],
        propertyKey: 'compute',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      expect(wrapped.call(instance, 5)).toBe(12); // (5+1)*2
    });
  });

  describe('this binding', () => {
    it('should bind original method to the correct this context', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      const original: (...args: unknown[]) => unknown = function (
        this: { prefix: string },
        name: unknown,
      ) {
        return `${this.prefix}, ${name}`;
      };

      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['name'],
        propertyKey: 'greet',
        descriptor,
      });

      const instance = { prefix: 'Hello', constructor: { name: 'TestService' } };
      expect(wrapped.call(instance, 'world')).toBe('Hello, world');
    });

    it('should pass a pre-bound method that works without explicit this', () => {
      let capturedMethod: ((...args: unknown[]) => unknown) | undefined;

      const wrapFn: WrapFn = (method, _context) => {
        capturedMethod = method;
        return (...args: unknown[]) => method(...args);
      };

      const original: (...args: unknown[]) => unknown = function (
        this: { value: string },
      ) {
        return this.value;
      };

      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'getValue',
        descriptor,
      });

      const instance = { value: 'instance-data', constructor: { name: 'TestService' } };
      wrapped.call(instance);

      // The captured method should be pre-bound to the instance
      expect(capturedMethod).toBeDefined();
      expect(capturedMethod!()).toBe('instance-data');
    });
  });

  describe('WrapContext fields', () => {
    it('should provide all expected context fields', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args: unknown[]) => method(...args);
      };

      function greet(name: string, greeting: string) {
        return `${greeting} ${name}`;
      }

      const original = asMethod(greet);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['name', 'greeting'],
        propertyKey: 'greet',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      wrapped.call(instance, 'world', 'hi');

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.target).toBe(instance);
      expect(capturedContext!.propertyKey).toBe('greet');
      expect(capturedContext!.parameterNames).toEqual(['name', 'greeting']);
      expect(capturedContext!.className).toBe('TestService');
      expect(capturedContext!.descriptor).toBe(descriptor);
    });

    it('should provide className from this.constructor.name', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args: unknown[]) => method(...args);
      };

      function doWork() {
        return 'done';
      }

      const original = asMethod(doWork);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'doWork',
        descriptor,
      });

      const instance = { constructor: { name: 'MySpecialService' } };
      wrapped.call(instance);

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.className).toBe('MySpecialService');
    });

    it('should NOT include args or argsObject in WrapContext', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args: unknown[]) => method(...args);
      };

      function doWork(x: number) {
        return x;
      }

      const original = asMethod(doWork);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['x'],
        propertyKey: 'doWork',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      wrapped.call(instance, 42);

      expect(capturedContext).toBeDefined();
      expect('args' in capturedContext!).toBe(false);
      expect('argsObject' in capturedContext!).toBe(false);
    });

    it('should return empty string for className when constructor has no name', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args: unknown[]) => method(...args);
      };

      function doWork() {
        return 'done';
      }

      const original = asMethod(doWork);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'doWork',
        descriptor,
      });

      // Instance with a constructor that lacks a name property
      const instance = { constructor: {} };
      wrapped.call(instance as object);

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.className).toBe('');
    });
  });

  describe('parameter names reuse', () => {
    it('should reuse the same parameterNames reference across calls', () => {
      const contexts: WrapContext[] = [];

      const wrapFn: WrapFn = (method, context) => {
        contexts.push(context);
        return (...args: unknown[]) => method(...args);
      };

      function calculate(price: number, tax: number) {
        return price + tax;
      }

      const paramNames = ['price', 'tax'];
      const original = asMethod(calculate);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: paramNames,
        propertyKey: 'calculate',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      wrapped.call(instance, 100, 10);
      wrapped.call(instance, 200, 20);

      expect(contexts[0].parameterNames).toEqual(['price', 'tax']);
      expect(contexts[1].parameterNames).toEqual(['price', 'tax']);
      // Same reference passed each time (extracted once, reused)
      expect(contexts[0].parameterNames).toBe(contexts[1].parameterNames);
    });
  });

  describe('async methods', () => {
    it('should work with async methods', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      async function fetchData(id: number): Promise<string> {
        return `data-${id}`;
      }

      const original = asMethod(fetchData);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['id'],
        propertyKey: 'fetchData',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      const result = await wrapped.call(instance, 42);

      expect(result).toBe('data-42');
    });

    it('should allow async wrapper to modify async results', async () => {
      const wrapFn: WrapFn<Promise<string>> = (method, _context) => {
        return async (...args: unknown[]) => {
          const result = (await method(...args)) as string;
          return `modified: ${result}`;
        };
      };

      async function fetchData(id: number): Promise<string> {
        return `data-${id}`;
      }

      const original = asMethod(fetchData);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: ['id'],
        propertyKey: 'fetchData',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      const result = await wrapped.call(instance, 42);

      expect(result).toBe('modified: data-42');
    });

    it('should propagate async errors from the original method', async () => {
      const asyncError = new Error('async failure');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      async function failingAsync() {
        throw asyncError;
      }

      const original = asMethod(failingAsync);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'failingAsync',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      await expect(wrapped.call(instance)).rejects.toThrow(asyncError);
    });
  });

  describe('sync error propagation', () => {
    it('should propagate sync errors from the original method', () => {
      const syncError = new Error('sync failure');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      function failing(): never {
        throw syncError;
      }

      const original = asMethod(failing);
      const descriptor: PropertyDescriptor = { value: original, writable: true };
      const wrapped = wrapMethod(original, wrapFn, {
        parameterNames: [],
        propertyKey: 'failing',
        descriptor,
      });

      const instance = { constructor: { name: 'TestService' } };
      expect(() => wrapped.call(instance)).toThrow(syncError);
    });
  });

  describe('export from barrel', () => {
    it('should be importable from the main index', async () => {
      const indexModule = await import('../src/index');
      expect(typeof indexModule.wrapFunction).toBe('function');
    });
  });
});
