import { describe, it, expect, vi } from 'vitest';

import { WrapOnMethod, WRAP_KEY } from '../src/wrap-on-method';
import { getMeta, SetMeta } from '../src/set-meta.decorator';
import type { WrapFn, WrapContext } from '../src/hook.types';

describe('WrapOnMethod', () => {
  describe('WRAP_KEY', () => {
    it('should be a unique symbol', () => {
      expect(typeof WRAP_KEY).toBe('symbol');
      expect(WRAP_KEY.toString()).toContain('wrap');
    });
  });

  describe('basic wrapping', () => {
    it('should call wrapFn once on first invocation, not at decoration time', () => {
      const wrapFnSpy = vi.fn<WrapFn>((method, _context) => {
        return (...args) => method(...args);
      });

      class TestService {
        @WrapOnMethod(wrapFnSpy)
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      // wrapFn is NOT called at decoration time (lazy init)
      expect(wrapFnSpy).not.toHaveBeenCalled();

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      // Called once on first invocation
      expect(wrapFnSpy).toHaveBeenCalledTimes(1);
    });

    it('should call wrapFn once on first invocation, not on each invocation', () => {
      let wrapCount = 0;
      let callCount = 0;

      const wrapFn: WrapFn = (method, _context) => {
        wrapCount++;
        return (...args) => {
          callCount++;
          return method(...args);
        };
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        doWork() {
          return 42;
        }
      }

      // wrapFn NOT called at decoration time
      expect(wrapCount).toBe(0);
      expect(callCount).toBe(0);

      const service = new TestService();
      service.doWork();
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(1);

      service.doWork();
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(2);

      service.doWork();
      expect(wrapCount).toBe(1);
      expect(callCount).toBe(3);
    });

    it('should reuse the same factory function across instances', () => {
      let wrapCount = 0;

      const wrapFn: WrapFn = (method, _context) => {
        wrapCount++;
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        doWork() {
          return 42;
        }
      }

      // wrapFn NOT called at decoration time
      expect(wrapCount).toBe(0);

      const serviceA = new TestService();
      const serviceB = new TestService();

      serviceA.doWork();
      expect(wrapCount).toBe(1);

      serviceB.doWork();
      expect(wrapCount).toBe(1);

      serviceA.doWork();
      serviceB.doWork();
      expect(wrapCount).toBe(1);
    });

    it('should return the result from innerFn', () => {
      const wrapFn: WrapFn<number> = (method, _context) => {
        return (...args) => {
          const result = method(...args) as number;
          return result * 2;
        };
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        compute(x: number) {
          return x + 1;
        }
      }

      const service = new TestService();
      expect(service.compute(5)).toBe(12); // (5+1)*2
    });
  });

  describe('this binding', () => {
    it('should bind original method to the correct this context', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        prefix = 'Hello';

        @WrapOnMethod(wrapFn)
        greet(name: string) {
          return `${this.prefix}, ${name}`;
        }
      }

      const service = new TestService();
      expect(service.greet('world')).toBe('Hello, world');
    });

    it('should pass a method proxy that delegates to current this', () => {
      let capturedMethod: ((...args: unknown[]) => unknown) | undefined;

      const wrapFn: WrapFn = (method, _context) => {
        capturedMethod = method;
        return (...args) => method(...args);
      };

      class TestService {
        value = 'instance-data';

        @WrapOnMethod(wrapFn)
        getValue() {
          return this.value;
        }
      }

      const service = new TestService();
      service.getValue();

      // Call the captured method directly -- the proxy delegates to currentInstance
      expect(capturedMethod).toBeDefined();
      expect(capturedMethod!()).toBe('instance-data');
    });
  });

  describe('WrapContext fields', () => {
    it('should provide target and className in WrapContext on first call', () => {
      let capturedCtx: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedCtx = context;
        return (...args) => method(...args);
      };

      class MySpecialService {
        @WrapOnMethod(wrapFn)
        doWork() {
          return 'done';
        }
      }

      const service = new MySpecialService();
      service.doWork();

      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.target).toBe(service);
      expect(capturedCtx!.className).toBe('MySpecialService');
    });

    it('should provide all decoration-time context fields', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        greet(name: string, greeting: string) {
          return `${greeting} ${name}`;
        }
      }

      const service = new TestService();
      service.greet('world', 'hi');

      // WrapContext captured on first invocation
      expect(capturedContext).toBeDefined();
      expect(capturedContext!.propertyKey).toBe('greet');
      expect(capturedContext!.parameterNames).toEqual(['name', 'greeting']);
      expect(capturedContext!.descriptor).toBeDefined();
      expect(typeof capturedContext!.descriptor.value).toBe('function');
    });

    it('should update target and className on each call (mutable context)', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
      };

      class TestService {
        constructor(private id: number) {}

        @WrapOnMethod(wrapFn)
        getId() {
          return this.id;
        }
      }

      const serviceA = new TestService(1);
      const serviceB = new TestService(2);

      serviceA.getId();
      expect(capturedContext!.target).toBe(serviceA);

      serviceB.getId();
      // Mutable context updates to reflect current caller
      expect(capturedContext!.target).toBe(serviceB);
    });
  });

  describe('parameter names extraction', () => {
    it('should extract parameter names at decoration time', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        calculate(price: number, tax: number, discount: number) {
          return price + tax - discount;
        }
      }

      const service = new TestService();
      service.calculate(100, 10, 5);

      expect(capturedContext!.parameterNames).toEqual(['price', 'tax', 'discount']);
    });

    it('should reuse the same WrapContext reference since wrapFn is called once', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        calculate(price: number, tax: number, discount: number) {
          return price + tax - discount;
        }
      }

      const serviceA = new TestService();
      serviceA.calculate(100, 10, 5);

      const firstCapture = capturedContext;

      const serviceB = new TestService();
      serviceB.calculate(200, 20, 10);

      // WrapContext is the same reference (captured once on first call)
      expect(capturedContext).toBe(firstCapture);
      expect(capturedContext!.parameterNames).toEqual(['price', 'tax', 'discount']);
    });

    it('should return empty array for a method with no parameters', () => {
      let capturedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        capturedContext = context;
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        noParams() {
          return 'ok';
        }
      }

      const service = new TestService();
      service.noParams();

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.parameterNames).toEqual([]);
    });
  });

  describe('exclusion key', () => {
    it('should set WRAP_KEY as default exclusion key', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        doWork() {
          return 'done';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );

      expect(getMeta<boolean>(WRAP_KEY, descriptor)).toBe(true);
    });

    it('should use custom exclusion key when provided', () => {
      const CUSTOM_KEY = Symbol('custom');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn, CUSTOM_KEY)
        doWork() {
          return 'done';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );

      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
    });

    it('should NOT set default WRAP_KEY when custom key is provided', () => {
      const CUSTOM_KEY = Symbol('custom');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn, CUSTOM_KEY)
        doWork() {
          return 'done';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );

      // Only the custom key should be set, not the default WRAP_KEY
      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
      expect(getMeta<boolean>(WRAP_KEY, descriptor)).toBeUndefined();
    });
  });

  describe('copySymMeta', () => {
    it('should preserve SetMeta metadata after wrapping', () => {
      const META_KEY = Symbol('testMeta');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        @SetMeta(META_KEY, 'preserved-value')
        doWork() {
          return 'done';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );

      expect(getMeta<string>(META_KEY, descriptor)).toBe('preserved-value');
    });

    it('should preserve multiple metadata entries', () => {
      const KEY_A = Symbol('a');
      const KEY_B = Symbol('b');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        @SetMeta(KEY_A, 'value-a')
        @SetMeta(KEY_B, 'value-b')
        doWork() {
          return 'done';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );

      expect(getMeta<string>(KEY_A, descriptor)).toBe('value-a');
      expect(getMeta<string>(KEY_B, descriptor)).toBe('value-b');
    });
  });

  describe('sync method wrapping', () => {
    it('should pass through the return value unchanged when wrapper delegates', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      expect(service.add(3, 4)).toBe(7);
    });

    it('should propagate sync errors from the original method', () => {
      const syncError = new Error('sync failure');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        failing() {
          throw syncError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(syncError);
    });
  });

  describe('async methods', () => {
    it('should work with async methods', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        async fetchData(id: number): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toBe('data-42');
    });

    it('should allow async wrapper to modify async results', async () => {
      const wrapFn: WrapFn<Promise<string>> = (method, _context) => {
        return async (...args) => {
          const result = (await method(...args)) as string;
          return `modified: ${result}`;
        };
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        async fetchData(id: number): Promise<string> {
          return `data-${id}`;
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toBe('modified: data-42');
    });

    it('should propagate async errors (rejected promises) from the original method', async () => {
      const asyncError = new Error('async failure');

      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        @WrapOnMethod(wrapFn)
        async failingAsync() {
          throw asyncError;
        }
      }

      const service = new TestService();
      await expect(service.failingAsync()).rejects.toThrow(asyncError);
    });
  });

  describe('method decorator return type', () => {
    it('should return a valid MethodDecorator', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      const decorator = WrapOnMethod(wrapFn);
      expect(typeof decorator).toBe('function');
    });

    it('should replace descriptor.value with the wrapped function', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => method(...args);
      };

      class TestService {
        original() {
          return 'original';
        }
      }

      const originalFn = TestService.prototype.original;
      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'original',
      )!;

      WrapOnMethod(wrapFn)(TestService.prototype, 'original', descriptor);

      // descriptor.value should now be a different function (the wrapped one)
      expect(descriptor.value).not.toBe(originalFn);
      expect(typeof descriptor.value).toBe('function');
    });
  });
});
