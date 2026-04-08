import { describe, it, expect, vi } from 'vitest';

import { WrapOnClass } from '../src/wrap-on-class';
import { WrapOnMethod, WRAP_APPLIED_KEY } from '../src/wrap-on-method';
import { SetMeta, getMeta } from '../src/set-meta.decorator';
import type { WrapFn, WrapContext } from '../src/hook.types';

describe('WrapOnClass', () => {
  describe('wraps all regular prototype methods', () => {
    it('should wrap every eligible method with the provided WrapFn', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          return 'b';
        }

        methodC() {
          return 'c';
        }
      }

      const service = new TestService();
      expect(service.methodA()).toBe('a');
      expect(service.methodB()).toBe('b');
      expect(service.methodC()).toBe('c');

      expect(calls).toEqual(['methodA', 'methodB', 'methodC']);
    });

    it('should preserve correct return values from wrapped methods', () => {
      const wrapFn: WrapFn = (method) => {
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn)
      class Calculator {
        add(a: number, b: number) {
          return a + b;
        }

        multiply(a: number, b: number) {
          return a * b;
        }
      }

      const calc = new Calculator();
      expect(calc.add(2, 3)).toBe(5);
      expect(calc.multiply(4, 5)).toBe(20);
    });
  });

  describe('skips constructor', () => {
    it('should not fire the wrapper during construction', () => {
      const wrapFnSpy = vi.fn<WrapFn>((method, _context) => {
        return (...args: unknown[]) => method(...args);
      });

      @WrapOnClass(wrapFnSpy)
      class TestService {
        value: number;

        constructor() {
          this.value = 42;
        }

        doWork() {
          return this.value;
        }
      }

      const service = new TestService();
      expect(service.value).toBe(42);

      // WrapFn should not have been called during construction
      expect(wrapFnSpy).not.toHaveBeenCalled();

      // But should fire when calling a method
      service.doWork();
      expect(wrapFnSpy).toHaveBeenCalledOnce();
    });

    it('should not include constructor in the set of wrapped property names', () => {
      const wrappedNames: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        wrappedNames.push(String(context.propertyKey));
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn)
      class TestService {
        constructor() {
          // intentionally empty
        }

        alpha() {
          return 'alpha';
        }

        beta() {
          return 'beta';
        }
      }

      const service = new TestService();
      service.alpha();
      service.beta();

      expect(wrappedNames).toEqual(['alpha', 'beta']);
      expect(wrappedNames).not.toContain('constructor');
    });
  });

  describe('skips getters and setters', () => {
    it('should not wrap getter or setter accessors', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        private _value = 0;

        get value() {
          return this._value;
        }

        set value(v: number) {
          this._value = v;
        }

        doWork() {
          return 'work';
        }
      }

      const service = new TestService();
      service.value = 10;
      void service.value;
      service.doWork();

      // Only doWork should be wrapped, not the getter/setter
      expect(calls).toEqual(['doWork']);
    });

    it('should skip getter-only properties', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        get computed() {
          return 42;
        }

        doWork() {
          return 'done';
        }
      }

      const service = new TestService();
      void service.computed;
      service.doWork();

      expect(calls).toEqual(['doWork']);
    });

    it('should skip setter-only properties', () => {
      const calls: string[] = [];
      let stored = 0;

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        set data(v: number) {
          stored = v;
        }

        doWork() {
          return 'done';
        }
      }

      const service = new TestService();
      service.data = 99;
      service.doWork();

      expect(stored).toBe(99);
      expect(calls).toEqual(['doWork']);
    });
  });

  describe('skips non-function prototype values', () => {
    it('should not attempt to wrap non-function prototype properties', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      // Add a non-function property to the prototype after decoration
      Object.defineProperty(TestService.prototype, 'staticValue', {
        value: 42,
        writable: true,
        enumerable: true,
        configurable: true,
      });

      const service = new TestService();
      service.doWork();

      expect(calls).toEqual(['doWork']);
    });

    it('should skip string and object prototype values', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      class TestService {
        doWork() {
          return 'work';
        }
      }

      // Add non-function values to prototype before applying decorator
      Object.defineProperty(TestService.prototype, 'label', {
        value: 'test-label',
        writable: true,
        configurable: true,
      });
      Object.defineProperty(TestService.prototype, 'config', {
        value: { timeout: 5000 },
        writable: true,
        configurable: true,
      });

      WrapOnClass(wrapFn)(TestService);

      const service = new TestService();
      service.doWork();

      expect(calls).toEqual(['doWork']);
    });
  });

  describe('skips methods marked with exclusion key via SetMeta', () => {
    it('should skip methods explicitly excluded via SetMeta with default key', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        @SetMeta(WRAP_APPLIED_KEY, true)
        excluded() {
          return 'excluded';
        }

        included() {
          return 'included';
        }
      }

      const service = new TestService();
      service.excluded();
      service.included();

      // Only included should be wrapped; excluded was marked with SetMeta
      expect(calls).toEqual(['included']);
    });

    it('should skip methods explicitly excluded via SetMeta with custom key', () => {
      const CUSTOM_KEY = Symbol('custom');
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn, CUSTOM_KEY)
      class TestService {
        @SetMeta(CUSTOM_KEY, true)
        excluded() {
          return 'excluded';
        }

        included() {
          return 'included';
        }
      }

      const service = new TestService();
      service.excluded();
      service.included();

      // Only included should be wrapped; excluded was marked with SetMeta
      expect(calls).toEqual(['included']);
    });
  });

  describe('skips methods already wrapped at method level', () => {
    it('should skip methods already decorated with WrapOnMethod (default key)', () => {
      const classCalls: string[] = [];
      const methodCalls: string[] = [];

      const classWrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          classCalls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      const methodWrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          methodCalls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(classWrapFn)
      class TestService {
        @WrapOnMethod(methodWrapFn)
        alreadyWrapped() {
          return 'wrapped';
        }

        notWrapped() {
          return 'not wrapped';
        }
      }

      const service = new TestService();
      service.alreadyWrapped();
      service.notWrapped();

      // alreadyWrapped was decorated by WrapOnMethod, so class decorator skips it
      expect(methodCalls).toEqual(['alreadyWrapped']);
      expect(classCalls).toEqual(['notWrapped']);
    });

    it('should skip methods already decorated with WrapOnMethod (custom key)', () => {
      const CUSTOM_KEY = Symbol('custom');
      const classCalls: string[] = [];
      const methodCalls: string[] = [];

      const classWrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          classCalls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      const methodWrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          methodCalls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(classWrapFn, CUSTOM_KEY)
      class TestService {
        @WrapOnMethod(methodWrapFn, CUSTOM_KEY)
        alreadyWrapped() {
          return 'wrapped';
        }

        notWrapped() {
          return 'not wrapped';
        }
      }

      const service = new TestService();
      service.alreadyWrapped();
      service.notWrapped();

      // The custom exclusion key should still prevent double-wrapping
      expect(methodCalls).toEqual(['alreadyWrapped']);
      expect(classCalls).toEqual(['notWrapped']);
    });
  });

  describe('WRAP_APPLIED_KEY used as default exclusion key', () => {
    it('should default to WRAP_APPLIED_KEY when no exclusionKey is provided', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        @SetMeta(WRAP_APPLIED_KEY, true)
        excluded() {
          return 'excluded';
        }

        included() {
          return 'included';
        }
      }

      const service = new TestService();
      service.excluded();
      service.included();

      // excluded was marked with WRAP_APPLIED_KEY, so WrapOnClass skips it
      expect(calls).toEqual(['included']);
    });

    it('should set WRAP_APPLIED_KEY metadata on methods it wraps', () => {
      const wrapFn: WrapFn = (method) => {
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      )!;
      expect(getMeta<boolean>(WRAP_APPLIED_KEY, descriptor)).toBe(true);
    });
  });

  describe('custom exclusion key propagated to WrapOnMethod', () => {
    it('should set custom exclusion key metadata on wrapped methods', () => {
      const CUSTOM_KEY = Symbol('custom');

      const wrapFn: WrapFn = (method) => {
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn, CUSTOM_KEY)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      // WrapOnClass delegates to WrapOnMethod with the custom key,
      // so the wrapped method should have the custom key metadata set
      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      )!;
      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
    });

    it('should not set WRAP_APPLIED_KEY when a custom key is provided', () => {
      const CUSTOM_KEY = Symbol('custom');

      const wrapFn: WrapFn = (method) => {
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn, CUSTOM_KEY)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      )!;

      // Custom key should be set
      expect(getMeta<boolean>(CUSTOM_KEY, descriptor)).toBe(true);
      // Default WRAP_APPLIED_KEY should NOT be set since custom key was used
      expect(getMeta<boolean>(WRAP_APPLIED_KEY, descriptor)).toBeUndefined();
    });

    it('should allow different WrapOnClass decorators with different keys', () => {
      const KEY_A = Symbol('keyA');
      const KEY_B = Symbol('keyB');
      const callsA: string[] = [];
      const callsB: string[] = [];

      const wrapFnA: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          callsA.push(String(context.propertyKey));
          return method(...args);
        };
      };

      const wrapFnB: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          callsB.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFnA, KEY_A)
      @WrapOnClass(wrapFnB, KEY_B)
      class TestService {
        doWork() {
          return 'work';
        }
      }

      const service = new TestService();
      service.doWork();

      // Both class-level decorators should wrap the method since they use
      // different exclusion keys and do not interfere with each other
      expect(callsA).toEqual(['doWork']);
      expect(callsB).toEqual(['doWork']);
    });
  });

  describe('this binding is preserved', () => {
    it('should preserve this context in wrapped methods', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn)
      class TestService {
        name = 'test';

        getName() {
          return this.name;
        }
      }

      const service = new TestService();
      expect(service.getName()).toBe('test');
    });
  });

  describe('WrapContext is correctly populated', () => {
    it('should pass correct WrapContext fields for each wrapped method', () => {
      const capturedContexts: WrapContext[] = [];

      const wrapFn: WrapFn = (method, context) => {
        capturedContexts.push(context);
        return (...args: unknown[]) => method(...args);
      };

      @WrapOnClass(wrapFn)
      class TestService {
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      service.greet('world');

      expect(capturedContexts).toHaveLength(1);

      const ctx = capturedContexts[0];
      expect(ctx.target).toBe(service);
      expect(ctx.propertyKey).toBe('greet');
      expect(ctx.parameterNames).toEqual(['name']);
      expect(ctx.className).toBe('TestService');
      expect(ctx.descriptor).toBeDefined();
    });
  });

  describe('async methods', () => {
    it('should wrap async methods correctly', async () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @WrapOnClass(wrapFn)
      class TestService {
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(1);

      expect(result).toEqual({ id: 1, name: 'test' });
      expect(calls).toEqual(['fetchData']);
    });
  });
});
