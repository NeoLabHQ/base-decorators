import { describe, it, expect, expectTypeOf } from 'vitest';

import { Wrap } from '../src/wrap.decorator';
import { Effect } from '../src/effect.decorator';
import { OnInvokeHook } from '../src/on-invoke.hook';
import { OnReturnHook } from '../src/on-return.hook';
import { OnErrorHook } from '../src/on-error.hook';
import { FinallyHook } from '../src/finally.hook';
import type {
  WrapContext,
  WrapFn,
  TypedMethodDecorator,
  HookContext,
  HookArgs,
  OnReturnContext,
  OnErrorContext,
  OnInvokeHookType,
  OnReturnHookType,
  OnErrorHookType,
  FinallyHookType,
  EffectHooks,
  HooksOrFactory,
  UnwrapPromise,
  MaybeAsync,
} from '../src/hook.types';

describe('hook.types', () => {
  describe('WrapContext (includes decoration-time + runtime fields)', () => {
    it('contains decoration-time and runtime fields', () => {
      const ctx: WrapContext = {
        propertyKey: 'method',
        parameterNames: ['a', 'b'],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'TestClass',
      };

      expect(ctx.propertyKey).toBe('method');
      expect(ctx.parameterNames).toEqual(['a', 'b']);
      expect(ctx.descriptor).toBeDefined();
      expect(ctx.target).toBeDefined();
      expect(ctx.className).toBe('TestClass');
    });
  });

  describe('WrapFn', () => {
    it('accepts method and WrapContext and returns a function taking args', () => {
      const wrapFn: WrapFn = (method, _context) => {
        return (...args) => {
          return method(...args);
        };
      };

      const fakeMethod = (...args: unknown[]) => args[0];
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      const innerFn = wrapFn(fakeMethod, ctx);
      expect(innerFn(42)).toBe(42);
    });

    it('supports generic return type parameter', () => {
      const wrapFn: WrapFn<object, unknown[], number> = (method, _context) => {
        return (...args) => {
          return method(...args) * 2;
        };
      };

      const fakeMethod = (..._args: unknown[]) => 21;
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      const innerFn = wrapFn(fakeMethod, ctx);
      expect(innerFn()).toBe(42);
    });
  });

  describe('HookContext extends WrapContext with args', () => {
    it('contains all WrapContext fields plus args and argsObject', () => {
      const hookCtx: HookContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: ['x'],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [1],
        argsObject: { x: 1 },
      };

      expect(hookCtx.target).toBeDefined();
      expect(hookCtx.propertyKey).toBe('method');
      expect(hookCtx.parameterNames).toEqual(['x']);
      expect(hookCtx.className).toBe('Cls');
      expect(hookCtx.descriptor).toBeDefined();
      expect(hookCtx.args).toEqual([1]);
      expect(hookCtx.argsObject).toEqual({ x: 1 });
    });

    it('is assignable to WrapContext (structural subtype)', () => {
      const hookCtx: HookContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
      };

      const wrapCtx: WrapContext = hookCtx;
      expect(wrapCtx.propertyKey).toBe('method');
    });
  });

  describe('existing type exports remain unchanged', () => {
    it('HookArgs type is available', () => {
      const args: HookArgs = { a: 1 };
      expect(args).toBeDefined();
    });

    it('OnReturnContext extends HookContext with result', () => {
      const ctx: OnReturnContext<object, unknown[], number> = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        result: 42,
      };
      expect(ctx.result).toBe(42);
    });

    it('OnErrorContext extends HookContext with error', () => {
      const ctx: OnErrorContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        error: new Error('test'),
      };
      expect(ctx.error).toBeDefined();
    });

    it('EffectHooks type is available', () => {
      const hooks: EffectHooks = {};
      expect(hooks).toBeDefined();
    });

    it('HooksOrFactory type is available', () => {
      const hooks: HooksOrFactory = {};
      expect(hooks).toBeDefined();
    });

    it('UnwrapPromise type is available', () => {
      type Result = UnwrapPromise<Promise<string>>;
      const value: Result = 'test';
      expect(value).toBe('test');
    });

    it('MaybeAsync type is available', () => {
      type Result = MaybeAsync<Promise<string>>;
      const value: Result = 'test';
      expect(value).toBe('test');
    });

    it('hook type aliases are available', () => {
      const onInvoke: OnInvokeHookType = (_ctx) => {};
      const onReturn: OnReturnHookType = (_ctx) => _ctx.result;
      const onError: OnErrorHookType = (_ctx) => { throw _ctx.error; };
      const finallyHook: FinallyHookType = (_ctx) => {};

      expect(onInvoke).toBeDefined();
      expect(onReturn).toBeDefined();
      expect(onError).toBeDefined();
      expect(finallyHook).toBeDefined();
    });
  });

  describe('generic type parameters (compile-time inference)', () => {
    it('WrapContext accepts explicit generic parameters', () => {
      class MyService { name = 'svc'; }

      const ctx: WrapContext<MyService> = {
        propertyKey: 'method',
        parameterNames: ['id', 'name'],
        descriptor: { value: () => true, writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      // target is typed as MyService
      expect(ctx.target.name).toBe('svc');
      expect(ctx.propertyKey).toBe('method');
    });

    it('WrapFn with explicit generics types the method and context', () => {
      class MyService { id = 1; }

      const wrapFn: WrapFn<MyService, [number, string], string> = (method, context) => {
        // method accepts [number, string] and returns string
        // context.target is MyService
        expect(context.target.id).toBe(1);
        return (...args) => {
          const result = method(...args);
          return `wrapped: ${result}`;
        };
      };

      // Verify the factory function exists and is callable
      const fakeMethod = (_a: number, _b: string) => 'hello';
      const ctx: WrapContext<MyService> = {
        propertyKey: 'test',
        parameterNames: ['a', 'b'],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      const inner = wrapFn(fakeMethod, ctx);
      expect(inner(42, 'world')).toBe('wrapped: hello');
    });

    it('WrapFn defaults preserve backward compatibility', () => {
      // WrapFn<object, unknown[], number> sets TReturn = number while T and TArgs default
      const wrapFn: WrapFn<object, unknown[], number> = (method, _context) => {
        return (...args) => {
          const result = method(...args);
          return typeof result === 'number' ? result * 2 : 0;
        };
      };

      const fakeMethod = (..._args: unknown[]) => 21;
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      const innerFn = wrapFn(fakeMethod, ctx);
      expect(innerFn()).toBe(42);
    });

    it('HookContext accepts explicit generic parameters', () => {
      class MyService { label = 'test'; }

      const hookCtx: HookContext<MyService, [number]> = {
        target: new MyService(),
        propertyKey: 'method',
        parameterNames: ['id'],
        className: 'MyService',
        descriptor: { value: () => 'ok', writable: true, enumerable: true, configurable: true },
        args: [42],
        argsObject: { id: 42 },
      };

      // target is typed as MyService
      expect(hookCtx.target.label).toBe('test');
      // args is typed as [number]
      expect(hookCtx.args).toEqual([42]);
    });

    it('OnReturnContext accepts explicit generic parameters', () => {
      const ctx: OnReturnContext<object, unknown[], string> = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        result: 'hello',
      };

      expect(ctx.result).toBe('hello');
    });

    it('generic WrapContext is assignable to default WrapContext (structural subtype)', () => {
      class MyService { name = 'svc'; }

      const specific: WrapContext<MyService> = {
        propertyKey: 'method',
        parameterNames: ['id'],
        descriptor: { value: () => 'ok', writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      // A specific WrapContext should be assignable to the default WrapContext
      const general: WrapContext = specific;
      expect(general.propertyKey).toBe('method');
    });
  });

  describe('compile-time type assertions (expectTypeOf)', () => {
    it('WrapContext target is inferred as T when specified', () => {
      class MyService { name = 'svc'; }

      const ctx: WrapContext<MyService> = {
        propertyKey: 'method',
        parameterNames: [],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      expectTypeOf(ctx.target).toEqualTypeOf<MyService>();
      expectTypeOf(ctx.propertyKey).toEqualTypeOf<string | symbol>();
      expectTypeOf(ctx.parameterNames).toEqualTypeOf<string[]>();
      expectTypeOf(ctx.className).toEqualTypeOf<string>();
    });

    it('WrapContext defaults target to object when no generic specified', () => {
      const ctx: WrapContext = {
        propertyKey: 'method',
        parameterNames: [],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      expectTypeOf(ctx.target).toEqualTypeOf<object>();
    });

    it('HookContext args is inferred as TArgs when specified', () => {
      class MyService { label = 'test'; }

      const hookCtx: HookContext<MyService, [number, string]> = {
        target: new MyService(),
        propertyKey: 'method',
        parameterNames: ['id', 'name'],
        className: 'MyService',
        descriptor: { value: () => 'ok', writable: true, enumerable: true, configurable: true },
        args: [42, 'hello'],
        argsObject: { id: 42, name: 'hello' },
      };

      expectTypeOf(hookCtx.target).toEqualTypeOf<MyService>();
      expectTypeOf(hookCtx.args).toEqualTypeOf<[number, string]>();
      expectTypeOf(hookCtx.argsObject).toEqualTypeOf<HookArgs>();
    });

    it('HookContext defaults args to unknown[] when no generic specified', () => {
      const hookCtx: HookContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Test',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
      };

      expectTypeOf(hookCtx.args).toEqualTypeOf<unknown[]>();
    });

    it('WrapFn method parameter reflects TArgs and TReturn', () => {
      class Svc { id = 1; }
      type MyWrapFn = WrapFn<Svc, [number, string], boolean>;

      // Verify the method parameter accepts (number, string) and returns boolean
      const fn: MyWrapFn = (method, context) => {
        expectTypeOf(method).toEqualTypeOf<(a: number, b: string) => boolean>();
        expectTypeOf(context.target).toEqualTypeOf<Svc>();
        return (...args) => {
          expectTypeOf(args).toEqualTypeOf<[number, string]>();
          return method(...args);
        };
      };

      // Prevent unused variable warning
      expect(fn).toBeDefined();
    });

    it('WrapFn inner function returns TReturn', () => {
      type NumberWrapFn = WrapFn<object, unknown[], number>;

      const fn: NumberWrapFn = (method, _ctx) => {
        return (...args) => {
          void method(...args);
          return 42;
        };
      };

      const fakeMethod = (..._args: unknown[]) => 0;
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      const inner = fn(fakeMethod, ctx);
      expectTypeOf(inner).toEqualTypeOf<(...args: unknown[]) => number>();
    });

    it('OnReturnContext result is UnwrapPromise<TReturn>', () => {
      // For sync return type
      const syncCtx: OnReturnContext<object, unknown[], number> = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        result: 42,
      };

      expectTypeOf(syncCtx.result).toEqualTypeOf<number>();

      // For async return type, result is unwrapped
      const asyncCtx: OnReturnContext<object, unknown[], Promise<string>> = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        result: 'unwrapped',
      };

      expectTypeOf(asyncCtx.result).toEqualTypeOf<string>();
    });

    it('OnErrorContext extends HookContext with error field', () => {
      const ctx: OnErrorContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        error: new Error('test'),
      };

      expectTypeOf(ctx.error).toEqualTypeOf<unknown>();
      expectTypeOf(ctx.target).toEqualTypeOf<object>();
    });

    it('generic WrapContext is structurally assignable to default WrapContext', () => {
      class MyService { name = 'svc'; }

      const specific: WrapContext<MyService> = {
        propertyKey: 'method',
        parameterNames: ['id'],
        descriptor: { value: () => 'ok', writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      // Verify assignability at compile time
      expectTypeOf(specific).toMatchTypeOf<WrapContext>();
    });
  });

  describe('negative compile-time type assertions (@ts-expect-error)', () => {
    it('WrapContext rejects wrong target type', () => {
      class MyService { name = 'svc'; }

      const ctx: WrapContext<MyService> = {
        propertyKey: 'method',
        parameterNames: [],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: new MyService(),
        className: 'MyService',
      };

      // @ts-expect-error - target is MyService, not assignable to number
      const _wrong: number = ctx.target;
      expect(_wrong).toBeDefined();
    });

    it('HookContext rejects wrong args tuple type', () => {
      const ctx: HookContext<object, [number, string]> = {
        target: {},
        propertyKey: 'method',
        parameterNames: ['a', 'b'],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [1, 'hello'],
        argsObject: { a: 1, b: 'hello' },
      };

      // @ts-expect-error - args is [number, string], not [boolean]
      const _wrong: [boolean] = ctx.args;
      expect(_wrong).toBeDefined();
    });

    it('WrapContext T must extend object', () => {
      // @ts-expect-error - string does not extend object
      type _BadCtx = WrapContext<string>;
      expect(true).toBe(true);
    });

    it('WrapFn method parameter rejects incompatible call signatures', () => {
      // A WrapFn typed for [number] args should not accept [string] args
      type NumberArgsWrapFn = WrapFn<object, [number], unknown>;

      const fn: NumberArgsWrapFn = (method, _ctx) => {
        return (...args) => {
          return method(...args);
        };
      };

      const fakeMethod = (_a: number) => undefined;
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: ['a'],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
      };

      const inner = fn(fakeMethod, ctx);

      // @ts-expect-error - inner expects (number), not (string)
      inner('wrong');
      expect(true).toBe(true);
    });

    it('OnReturnContext rejects wrong result type', () => {
      const ctx: OnReturnContext<object, unknown[], number> = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
        result: 42,
      };

      // @ts-expect-error - result is number, not string
      const _wrong: string = ctx.result;
      expect(_wrong).toBeDefined();
    });
  });

  describe('generic propagation through Effect hook type aliases', () => {
    it('OnInvokeHookType propagates T and TArgs to its HookContext', () => {
      class Svc { id = 1; }

      const hook: OnInvokeHookType<Svc, [number]> = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
        expectTypeOf(ctx.args).toEqualTypeOf<[number]>();
      };

      expect(hook).toBeDefined();
    });

    it('OnReturnHookType propagates T and TArgs to its OnReturnContext', () => {
      class Svc { name = 'test'; }

      const hook: OnReturnHookType<Svc, [string], number> = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
        expectTypeOf(ctx.args).toEqualTypeOf<[string]>();
        expectTypeOf(ctx.result).toEqualTypeOf<number>();
        return ctx.result;
      };

      expect(hook).toBeDefined();
    });

    it('OnErrorHookType propagates T and TArgs to its OnErrorContext', () => {
      class Svc { label = 'err'; }

      const hook: OnErrorHookType<Svc, [boolean], string> = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
        expectTypeOf(ctx.args).toEqualTypeOf<[boolean]>();
        expectTypeOf(ctx.error).toEqualTypeOf<unknown>();
        return 'recovered';
      };

      expect(hook).toBeDefined();
    });

    it('FinallyHookType propagates T and TArgs to its HookContext', () => {
      class Svc { done = false; }

      const hook: FinallyHookType<Svc, [number, string]> = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
        expectTypeOf(ctx.args).toEqualTypeOf<[number, string]>();
      };

      expect(hook).toBeDefined();
    });

    it('EffectHooks propagates generics to all hook types', () => {
      class Svc { id = 1; }

      const hooks: EffectHooks<Svc, [string], number> = {
        onInvoke: (ctx) => {
          expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
          expectTypeOf(ctx.args).toEqualTypeOf<[string]>();
        },
        onReturn: (ctx) => {
          expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
          expectTypeOf(ctx.result).toEqualTypeOf<number>();
          return ctx.result;
        },
      };

      expect(hooks).toBeDefined();
    });

    it('HooksOrFactory propagates generics to factory context', () => {
      class Svc { name = 'factory'; }

      const factory: HooksOrFactory<Svc, [number], string> = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<Svc>();
        return {
          onReturn: (returnCtx) => {
            expectTypeOf(returnCtx.target).toEqualTypeOf<Svc>();
            expectTypeOf(returnCtx.args).toEqualTypeOf<[number]>();
            return returnCtx.result;
          },
        };
      };

      expect(factory).toBeDefined();
    });

    it('hook type aliases default to unparameterized HookContext when no generics specified', () => {
      const hook: OnInvokeHookType = (ctx) => {
        expectTypeOf(ctx.target).toEqualTypeOf<object>();
        expectTypeOf(ctx.args).toEqualTypeOf<unknown[]>();
      };

      expect(hook).toBeDefined();
    });
  });

  describe('Wrap return type and TypedMethodDecorator types', () => {
    it('Wrap returns ClassDecorator & TypedMethodDecorator', () => {
      const decorator = Wrap((method, _ctx) => {
        return (...args: unknown[]) => method(...args);
      });

      expect(decorator).toBeDefined();
      expectTypeOf(decorator).toMatchTypeOf<ClassDecorator>();
      expectTypeOf(decorator).toMatchTypeOf<TypedMethodDecorator<unknown[], unknown>>();
    });

    it('TypedMethodDecorator type is exported', () => {
      type AssertIsType = TypedMethodDecorator<unknown[], unknown>;

      const fn: AssertIsType = (_target, _key, descriptor) => {
        return descriptor;
      };

      expect(fn).toBeDefined();
    });
  });

  describe('Wrap decorator preserves method types at decoration site', () => {
    it('preserves method signature through typed Wrap decoration', () => {
      const TestDecorator = Wrap<object, [string, number], string>((method, _ctx) => {
        return (...args) => method(...args);
      });

      class TestClass {
        @TestDecorator
        greet(name: string, count: number): string {
          return `Hello ${name} x${count}`;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.greet).toEqualTypeOf<(name: string, count: number) => string>();
    });

    it('preserves async method signature through typed Wrap decoration', () => {
      const TestDecorator = Wrap<object, [number], Promise<string>>((method, _ctx) => {
        return async (...args) => method(...args);
      });

      class TestClass {
        @TestDecorator
        async fetchData(id: number): Promise<string> {
          return `data-${id}`;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.fetchData).toEqualTypeOf<(id: number) => Promise<string>>();
    });

    it('preserves method signature when Wrap is used as factory return', () => {
      const Log = () => Wrap<object, [number, number], number>((method, _ctx) => {
        return (...args) => method(...args);
      });

      class TestClass {
        @Log()
        add(a: number, b: number): number {
          return a + b;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.add).toEqualTypeOf<(a: number, b: number) => number>();
    });

    it('preserves void return type', () => {
      const TestDecorator = Wrap<object, [string], void>((method, _ctx) => {
        return (...args) => method(...args);
      });

      class TestClass {
        @TestDecorator
        doWork(task: string): void {
          console.log(task);
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.doWork).toEqualTypeOf<(task: string) => void>();
    });

    it('preserves no-arg method signature', () => {
      const TestDecorator = Wrap<object, [], string>((method, _ctx) => {
        return (...args) => method(...args);
      });

      class TestClass {
        @TestDecorator
        getVersion(): string {
          return '1.0.0';
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.getVersion).toEqualTypeOf<() => string>();
    });
  });

  describe('Effect decorator preserves method types at decoration site', () => {
    it('preserves method signature through typed Effect decoration', () => {
      const TestDecorator = Effect<object, [string], string>({
        onInvoke: () => {},
      });

      class TestClass {
        @TestDecorator
        greet(name: string): string {
          return `Hello ${name}`;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.greet).toEqualTypeOf<(name: string) => string>();
    });

    it('preserves method signature when Effect is used as factory return', () => {
      const Log = (message: string) => Effect<object, [number, number], number>({
        onInvoke: () => console.log(message),
      });

      class TestClass {
        @Log('test')
        compute(a: number, b: number): number {
          return a + b;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.compute).toEqualTypeOf<(a: number, b: number) => number>();
    });
  });

  describe('convenience hook decorators preserve method types', () => {
    it('OnInvokeHook preserves method signature', () => {
      const decorator = OnInvokeHook<object, [string], string>(() => {});

      class TestClass {
        @decorator
        greet(name: string): string {
          return `Hello ${name}`;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.greet).toEqualTypeOf<(name: string) => string>();
    });

    it('OnReturnHook preserves method signature', () => {
      const decorator = OnReturnHook<object, [number], number>(({ result }) => result);

      class TestClass {
        @decorator
        compute(x: number): number {
          return x * 2;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.compute).toEqualTypeOf<(x: number) => number>();
    });

    it('OnErrorHook preserves method signature', () => {
      const decorator = OnErrorHook<object, [string], boolean>(({ error }) => { throw error; });

      class TestClass {
        @decorator
        riskyOp(input: string): boolean {
          return input.length > 0;
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.riskyOp).toEqualTypeOf<(input: string) => boolean>();
    });

    it('FinallyHook preserves method signature', () => {
      const decorator = FinallyHook<object, [number[]], string>(() => {});

      class TestClass {
        @decorator
        process(data: number[]): string {
          return data.join(',');
        }
      }

      const instance = new TestClass();
      expectTypeOf(instance.process).toEqualTypeOf<(data: number[]) => string>();
    });
  });

  describe('class-level decorators work as ClassDecorator', () => {
    it('Wrap works as class decorator', () => {
      const TestDecorator = Wrap((method, _ctx) => {
        return (...args: unknown[]) => method(...args);
      });

      @TestDecorator
      class TestClass {
        greet(name: string): string {
          return `Hello ${name}`;
        }
      }

      const instance = new TestClass();
      expect(instance.greet('world')).toBe('Hello world');
    });

    it('Effect works as class decorator', () => {
      const TestDecorator = Effect({
        onInvoke: () => {},
      });

      @TestDecorator
      class TestClass {
        add(a: number, b: number): number {
          return a + b;
        }
      }

      const instance = new TestClass();
      expect(instance.add(2, 3)).toBe(5);
    });
  });
});
