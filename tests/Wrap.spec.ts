import { describe, it, expect, vi } from 'vitest';

import { Wrap } from '../src/wrap.decorator';
import { SetMeta, getMeta } from '../src/set-meta.decorator';
import { WRAP_APPLIED_KEY } from '../src/wrap-on-method';
import type { WrapFn, WrapContext } from '../src/hook.types';

describe('Wrap', () => {
  describe('applied to a method', () => {
    it('should delegate to WrapOnMethod and wrap the method', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      class TestService {
        @Wrap(wrapFn)
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
    });

    it('should set WRAP_APPLIED_KEY on the method descriptor', () => {
      const wrapFn: WrapFn = (method) => (...args: unknown[]) => method(...args);

      class TestService {
        @Wrap(wrapFn)
        doWork() {
          return 42;
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'doWork',
      );
      expect(getMeta(WRAP_APPLIED_KEY, descriptor!)).toBe(true);
    });
  });

  describe('applied to a class', () => {
    it('should delegate to WrapOnClass and wrap all prototype methods', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @Wrap(wrapFn)
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          return 'b';
        }
      }

      const service = new TestService();
      service.methodA();
      service.methodB();

      expect(calls).toEqual(['methodA', 'methodB']);
    });

    it('should skip methods already decorated with Wrap at method level', () => {
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

      @Wrap(classWrapFn)
      class TestService {
        plain() {
          return 'plain';
        }

        @Wrap(methodWrapFn)
        decorated() {
          return 'decorated';
        }
      }

      const service = new TestService();
      service.plain();
      service.decorated();

      expect(classCalls).toEqual(['plain']);
      expect(methodCalls).toEqual(['decorated']);
    });

    it('should return the constructor when applied to a class', () => {
      const wrapFn: WrapFn = (method) => (...args: unknown[]) => method(...args);

      @Wrap(wrapFn)
      class TestService {
        doWork() {
          return 42;
        }
      }

      expect(typeof TestService).toBe('function');
      const service = new TestService();
      expect(service.doWork()).toBe(42);
    });

    it('should not wrap getters or setters', () => {
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @Wrap(wrapFn)
      class TestService {
        private _value = 10;

        get value() {
          return this._value;
        }

        set value(v: number) {
          this._value = v;
        }

        compute() {
          return this._value * 2;
        }
      }

      const service = new TestService();
      // Access getter -- should NOT trigger the wrapFn
      void service.value;
      // Use setter -- should NOT trigger the wrapFn
      service.value = 20;
      // Call regular method -- should trigger the wrapFn
      service.compute();

      expect(calls).toEqual(['compute']);
    });

    it('should not wrap the constructor', () => {
      const wrapFnSpy = vi.fn<WrapFn>((method, _context) => {
        return (...args: unknown[]) => method(...args);
      });

      @Wrap(wrapFnSpy)
      class TestService {
        value: number;

        constructor() {
          this.value = 42;
        }

        doWork() {
          return this.value;
        }
      }

      // wrapFn should not be called during construction
      expect(wrapFnSpy).not.toHaveBeenCalled();

      const service = new TestService();
      expect(service.value).toBe(42);

      service.doWork();
      expect(wrapFnSpy).toHaveBeenCalledOnce();
    });
  });

  describe('WrapFn receives bound method and WrapContext', () => {
    it('should pass WrapContext with all expected fields', () => {
      let receivedContext: WrapContext | undefined;

      const wrapFn: WrapFn = (method, context) => {
        receivedContext = context;
        return (...args: unknown[]) => method(...args);
      };

      class TestService {
        @Wrap(wrapFn)
        doWork(input: string) {
          return input.toUpperCase();
        }
      }

      const service = new TestService();
      service.doWork('test');

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.propertyKey).toBe('doWork');
      expect(receivedContext!.className).toBe('TestService');
      expect(receivedContext!.target).toBe(service);
      expect(receivedContext!.parameterNames).toEqual(['input']);
      expect(receivedContext!.descriptor).toBeDefined();
    });

    it('should NOT include args or argsObject on WrapContext', () => {
      let receivedContext: Record<string, unknown> | undefined;

      const wrapFn: WrapFn = (method, context) => {
        receivedContext = context as unknown as Record<string, unknown>;
        return (...args: unknown[]) => method(...args);
      };

      class TestService {
        @Wrap(wrapFn)
        doWork(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      service.doWork(1, 2);

      expect(receivedContext).toBeDefined();
      expect(receivedContext!['args']).toBeUndefined();
      expect(receivedContext!['argsObject']).toBeUndefined();
    });

    it('should pass a this-bound method to WrapFn', () => {
      let receivedMethod: ((...args: unknown[]) => unknown) | undefined;

      const wrapFn: WrapFn = (method, _context) => {
        receivedMethod = method;
        return (...args: unknown[]) => method(...args);
      };

      class TestService {
        name = 'TestInstance';

        @Wrap(wrapFn)
        getName() {
          return this.name;
        }
      }

      const service = new TestService();
      const result = service.getName();

      // The method returned the correct result via this binding
      expect(result).toBe('TestInstance');

      // Calling the captured bound method directly also works
      // (proving it is pre-bound, not requiring a this context)
      expect(receivedMethod!()).toBe('TestInstance');
    });

    it('should bind method to the correct instance for each invocation', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      class TestService {
        constructor(private id: number) {}

        @Wrap(wrapFn)
        getId() {
          return this.id;
        }
      }

      const serviceA = new TestService(1);
      const serviceB = new TestService(2);

      expect(serviceA.getId()).toBe(1);
      expect(serviceB.getId()).toBe(2);
    });
  });

  describe('sync method through Wrap', () => {
    it('should wrap a sync method and return its result unchanged', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => method(...args);
      };

      class Calculator {
        @Wrap(wrapFn)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const calc = new Calculator();
      expect(calc.add(2, 3)).toBe(5);
    });

    it('should allow Wrap to modify the sync return value', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => {
          const result = method(...args) as number;
          return result * 10;
        };
      };

      class Calculator {
        @Wrap(wrapFn)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const calc = new Calculator();
      expect(calc.add(2, 3)).toBe(50);
    });

    it('should allow Wrap to intercept arguments for sync methods', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args: unknown[]) => {
          // Intercept: double all numeric arguments
          const doubled = args.map((a) =>
            typeof a === 'number' ? a * 2 : a,
          );
          return method(...doubled);
        };
      };

      class Calculator {
        @Wrap(wrapFn)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const calc = new Calculator();
      // Wrap doubles the arguments: add(4, 6) => 10
      expect(calc.add(2, 3)).toBe(10);
    });
  });

  describe('async method through Wrap', () => {
    it('should wrap an async method and return its resolved value', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return async (...args: unknown[]) => {
          const result = await method(...args);
          return result;
        };
      };

      class TestService {
        @Wrap(wrapFn)
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42, name: 'test' });
    });

    it('should allow Wrap to modify the async return value', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return async (...args: unknown[]) => {
          const result = (await method(...args)) as { id: number; name: string };
          return { ...result, modified: true };
        };
      };

      class TestService {
        @Wrap(wrapFn)
        async fetchData(id: number) {
          return { id, name: 'test' };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42, name: 'test', modified: true });
    });

    it('should propagate errors from async methods', async () => {
      const wrapFn: WrapFn = (method, _context) => {
        return async (...args: unknown[]) => {
          return method(...args);
        };
      };

      const testError = new Error('async failure');

      class TestService {
        @Wrap(wrapFn)
        async failing() {
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failing()).rejects.toThrow(testError);
    });
  });

  describe('exclusion key prevents double-wrapping at class level', () => {
    it('should use custom exclusionKey for independent decorator isolation', () => {
      const CUSTOM_KEY = Symbol('custom');

      const calls: string[] = [];
      const wrapFnA: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(`A:${String(context.propertyKey)}`);
          return method(...args);
        };
      };

      const wrapFnB: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(`B:${String(context.propertyKey)}`);
          return method(...args);
        };
      };

      @Wrap(wrapFnA)
      class TestService {
        @Wrap(wrapFnB, CUSTOM_KEY)
        doWork() {
          return 42;
        }
      }

      const service = new TestService();
      service.doWork();

      // Both should be applied since they use different exclusion keys
      expect(calls).toContain('A:doWork');
      expect(calls).toContain('B:doWork');
    });

    it('should prevent double-wrap when class and method use same exclusionKey', () => {
      const SAME_KEY = Symbol('sameKey');
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

      @Wrap(classWrapFn, SAME_KEY)
      class TestService {
        @Wrap(methodWrapFn, SAME_KEY)
        decoratedMethod() {
          return 'result';
        }

        plainMethod() {
          return 'plain';
        }
      }

      const service = new TestService();
      service.decoratedMethod();
      service.plainMethod();

      // Method-level fires for decoratedMethod, class-level is skipped
      expect(methodCalls).toEqual(['decoratedMethod']);
      // Class-level fires only for plainMethod
      expect(classCalls).toEqual(['plainMethod']);
    });

    it('should skip methods marked with SetMeta using the exclusionKey', () => {
      const EXCLUSION_KEY = Symbol('noWrap');
      const calls: string[] = [];

      const wrapFn: WrapFn = (method, context) => {
        return (...args: unknown[]) => {
          calls.push(String(context.propertyKey));
          return method(...args);
        };
      };

      @Wrap(wrapFn, EXCLUSION_KEY)
      class TestService {
        @SetMeta(EXCLUSION_KEY, true)
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

      // Only included method should be wrapped
      expect(calls).toEqual(['included']);
    });

    it('should mark method with exclusionKey when applied at method level', () => {
      const EXCLUSION_KEY = Symbol('customKey');
      const wrapFn: WrapFn = (method) => (...args: unknown[]) => method(...args);

      class TestService {
        @Wrap(wrapFn, EXCLUSION_KEY)
        myMethod() {
          return 'result';
        }
      }

      const service = new TestService();
      expect(service.myMethod()).toBe('result');

      const descriptor = Object.getOwnPropertyDescriptor(
        TestService.prototype,
        'myMethod',
      )!;
      expect(getMeta<boolean>(EXCLUSION_KEY, descriptor)).toBe(true);
    });
  });

  describe('invalid decorator context', () => {
    it('should throw Error when applied in an unsupported context', () => {
      const wrapFn: WrapFn = (method) => (...args: unknown[]) => method(...args);

      const decorator = Wrap(wrapFn);

      // Simulate invalid context: propertyKey present but no descriptor
      expect(() => {
        (decorator as Function)({}, 'someMethod', undefined);
      }).toThrow('Wrap decorator can only be applied to classes or methods');
    });

    it('should throw Error with propertyKey present but descriptor missing', () => {
      const wrapFn: WrapFn = (method) => (...args: unknown[]) => method(...args);

      const decorator = Wrap(wrapFn);

      // PropertyKey is a symbol, descriptor is still undefined
      expect(() => {
        (decorator as Function)({}, Symbol('test'), undefined);
      }).toThrow('Wrap decorator can only be applied to classes or methods');
    });
  });
});
