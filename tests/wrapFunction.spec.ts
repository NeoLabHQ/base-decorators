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
    it('should call wrapFn once on first invocation, not at wrap time', () => {
      const wrapFnSpy = vi.fn<WrapFn>((method, _context) => {
        return (...args) => method(...args);
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

      // wrapFn is NOT called at wrap time (lazy init)
      expect(wrapFnSpy).not.toHaveBeenCalled();

      const instance = { constructor: { name: 'TestService' } };
      const result = wrapped.call(instance, 'world');

      expect(result).toBe('hello world');
      // Called once on first invocation
      expect(wrapFnSpy).toHaveBeenCalledTimes(1);
    });

    it('should invoke the inner function on each call, reusing the factory result', () => {
      let wrapCount = 0;
      let callCount = 0;

      const wrapFn: WrapFn = (method, _context) => {
        wrapCount++;
        return (...args) => {
          callCount++;
          return method(...args);
        };
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

      // wrapFn NOT called at wrap time
      expect(wrapCount).toBe(0);
      expect(callCount).toBe(0);

      const instance = { constructor: { name: 'TestService' } };

      wrapped.call(instance);
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(1);

      wrapped.call(instance);
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(2);

      wrapped.call(instance);
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(3);
    });

    it('should reuse the factory result for different instances', () => {
      let wrapCount = 0;

      const wrapFn: WrapFn = (method, _context) => {
        wrapCount++;
        return (...args) => method(...args);
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

      // wrapFn NOT called at wrap time
      expect(wrapCount).toBe(0);

      const instanceA = { constructor: { name: 'TestService' } };
      const instanceB = { constructor: { name: 'TestService' } };

      wrapped.call(instanceA);
      expect(wrapCount).toBe(1);

      wrapped.call(instanceB);
      expect(wrapCount).toBe(1);

      wrapped.call(instanceA);
      wrapped.call(instanceB);
      expect(wrapCount).toBe(1);
    });

    it('should return the result from the inner function', () => {
      const wrapFn: WrapFn<number> = (method, _context) => {
        return (...args) => {
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
        return (...args) => method(...args);
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

    it('should pass a method proxy that delegates to current instance', () => {
      let capturedMethod: ((...args: unknown[]) => unknown) | undefined;

      const wrapFn: WrapFn = (method, _context) => {
        capturedMethod = method;
        return (...args) => method(...args);
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

      // The captured method proxy delegates to the current instance
      expect(capturedMethod).toBeDefined();
      expect(capturedMethod!()).toBe('instance-data');
    });
  });

  describe('WrapContext fields', () => {
    it('should provide decoration-time and runtime context fields', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
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

      // WrapContext NOT captured at wrap time (lazy init)
      expect(capturedContext).toBeUndefined();

      const instance = { constructor: { name: 'TestService' } };
      wrapped.call(instance, 'world', 'hi');

      // WrapContext captured on first invocation
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.propertyKey).toBe('greet');
      expect(capturedContext!.parameterNames).toEqual(['name', 'greeting']);
      expect(capturedContext!.descriptor).toBe(descriptor);
      expect(capturedContext!.target).toBe(instance);
      expect(capturedContext!.className).toBe('TestService');
    });

    it('should provide target and className in WrapContext', () => {
      let capturedCtx: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedCtx = context;
        return (...args) => method(...args);
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

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.target).toBe(instance);
      expect(capturedCtx!.className).toBe('MySpecialService');
    });

    it('should include propertyKey, parameterNames, descriptor in WrapContext', () => {
      let capturedCtx: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedCtx = context;
        return (...args) => method(...args);
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

      const instance = { constructor: { name: 'TestService' } };
      wrapped.call(instance);

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.propertyKey).toBe('doWork');
      expect(capturedCtx!.parameterNames).toEqual([]);
      expect(capturedCtx!.descriptor).toBe(descriptor);
    });

    it('should return empty string for className when constructor has no name', () => {
      let capturedCtx: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedCtx = context;
        return (...args) => method(...args);
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

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.className).toBe('');
    });
  });

  describe('parameter names reuse', () => {
    it('should reuse the same WrapContext reference across calls', () => {
      const capturedContexts: WrapContext[] = [];

      const wrapFn: WrapFn = (_method, context) => {
        capturedContexts.push(context);
        return (...args) => _method(...args);
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

      const instanceA = { constructor: { name: 'TestService' } };
      const instanceB = { constructor: { name: 'TestService' } };
      wrapped.call(instanceA, 100, 10);
      wrapped.call(instanceB, 200, 20);

      // Only one context captured (factory called once)
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0].parameterNames).toEqual(['price', 'tax']);
    });
  });

  describe('async methods', () => {
    it('should work with async methods', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
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
        return async (...args) => {
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
        return (...args) => method(...args);
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
        return (...args) => method(...args);
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

    it('should export buildArgsObject from the main index', async () => {
      const indexModule = await import('../src/index');
      expect(typeof indexModule.buildArgsObject).toBe('function');
    });
  });
});
