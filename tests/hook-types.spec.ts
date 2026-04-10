import { describe, it, expect } from 'vitest';

import type {
  WrapContext,
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
      const wrapFn: WrapFn<number> = (method, _context) => {
        return (...args) => {
          return (method(...args) as number) * 2;
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
