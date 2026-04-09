import { describe, it, expect } from 'vitest';

import type {
  WrapContext,
  InvocationContext,
  WrapFn,
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
  describe('WrapContext (decoration-time)', () => {
    it('contains exactly the 3 decoration-time fields', () => {
      const ctx: WrapContext = {
        propertyKey: 'method',
        parameterNames: ['a', 'b'],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
      };

      expect(ctx.propertyKey).toBe('method');
      expect(ctx.parameterNames).toEqual(['a', 'b']);
      expect(ctx.descriptor).toBeDefined();
    });

    it('does not contain target, className, args, or argsObject', () => {
      const ctx: WrapContext = {
        propertyKey: 'method',
        parameterNames: [],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
      };

      expect(ctx).not.toHaveProperty('target');
      expect(ctx).not.toHaveProperty('className');
      expect(ctx).not.toHaveProperty('args');
      expect(ctx).not.toHaveProperty('argsObject');
    });
  });

  describe('InvocationContext (per-call, extends WrapContext)', () => {
    it('contains target, className, args, argsObject, plus WrapContext fields', () => {
      const invCtx: InvocationContext = {
        propertyKey: 'method',
        parameterNames: ['a', 'b'],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'TestClass',
        args: [1, 2],
        argsObject: { a: 1, b: 2 },
      };

      expect(invCtx.target).toBeDefined();
      expect(invCtx.className).toBe('TestClass');
      expect(invCtx.args).toEqual([1, 2]);
      expect(invCtx.argsObject).toEqual({ a: 1, b: 2 });
      expect(invCtx.propertyKey).toBe('method');
      expect(invCtx.parameterNames).toEqual(['a', 'b']);
      expect(invCtx.descriptor).toBeDefined();
    });

    it('is assignable to WrapContext (structural subtype)', () => {
      const invCtx: InvocationContext = {
        propertyKey: 'method',
        parameterNames: [],
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        target: {},
        className: 'Test',
        args: [],
        argsObject: undefined,
      };

      const wrapCtx: WrapContext = invCtx;
      expect(wrapCtx.propertyKey).toBe('method');
    });
  });

  describe('WrapFn', () => {
    it('accepts WrapContext and returns a function taking method and InvocationContext', () => {
      const wrapFn: WrapFn = (_context) => {
        return (method, invCtx) => {
          return method(...invCtx.args);
        };
      };

      const fakeMethod = (...args: unknown[]) => args[0];
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
      };

      const factory = wrapFn(ctx);
      const invCtx: InvocationContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: ctx.descriptor,
        target: {},
        className: 'Test',
        args: [42],
        argsObject: undefined,
      };
      expect(factory(fakeMethod, invCtx)).toBe(42);
    });

    it('supports generic return type parameter', () => {
      const wrapFn: WrapFn<number> = (_context) => {
        return (method, invCtx) => {
          return (method(...invCtx.args) as number) * 2;
        };
      };

      const fakeMethod = (..._args: unknown[]) => 21;
      const ctx: WrapContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: { value: fakeMethod, writable: true, enumerable: true, configurable: true },
      };

      const factory = wrapFn(ctx);
      const invCtx: InvocationContext = {
        propertyKey: 'test',
        parameterNames: [],
        descriptor: ctx.descriptor,
        target: {},
        className: 'Test',
        args: [],
        argsObject: undefined,
      };
      expect(factory(fakeMethod, invCtx)).toBe(42);
    });
  });

  describe('HookContext extends InvocationContext', () => {
    it('contains all 7 fields (3 from WrapContext + 4 runtime)', () => {
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

    it('is assignable to InvocationContext (structural subtype)', () => {
      const hookCtx: HookContext = {
        target: {},
        propertyKey: 'method',
        parameterNames: [],
        className: 'Cls',
        descriptor: { value: () => undefined, writable: true, enumerable: true, configurable: true },
        args: [],
        argsObject: undefined,
      };

      const invCtx: InvocationContext = hookCtx;
      expect(invCtx.target).toBeDefined();
      expect(invCtx.className).toBe('Cls');
    });
  });

  describe('existing type exports remain unchanged', () => {
    it('HookArgs type is available', () => {
      const args: HookArgs = { a: 1 };
      expect(args).toBeDefined();
    });

    it('OnReturnContext extends HookContext with result', () => {
      const ctx: OnReturnContext<number> = {
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
});
