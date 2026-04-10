import { describe, it, expect, vi } from 'vitest';

import { OnReturnHook } from '../src/on-return.hook';
import type { OnReturnContext, OnReturnHookType } from '../src/hook.types';

/** Permissive OnReturnHook wrapper for runtime-focused tests where type inference is not under test. */
const AnyOnReturnHook = (callback: OnReturnHookType<object, any[], any>, exclusionKey?: symbol) =>
  OnReturnHook<object, any[], any>(callback, exclusionKey);

describe('OnReturnHook', () => {
  describe('applied to a method', () => {
    it('should fire callback after sync method returns successfully', () => {
      const callOrder: string[] = [];
      const callback = vi.fn((ctx: OnReturnContext) => {
        callOrder.push('onReturn');
        return ctx.result;
      });

      class TestService {
        @AnyOnReturnHook(callback)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'onReturn']);
    });

    it('should fire callback after async method resolves', async () => {
      const callOrder: string[] = [];
      const callback = vi.fn((ctx: OnReturnContext) => {
        callOrder.push('onReturn');
        return ctx.result;
      });

      class TestService {
        @AnyOnReturnHook(callback)
        async fetchData(id: number) {
          callOrder.push('original');
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42 });
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'onReturn']);
    });

    it('should allow callback to transform the return value', () => {
      const callback = vi.fn((ctx: OnReturnContext) => `${ctx.result}-transformed`);

      class TestService {
        @AnyOnReturnHook(callback)
        greet(name: string) {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world-transformed');
    });

    it('should not fire callback when method throws', () => {
      const callback = vi.fn((ctx: OnReturnContext) => ctx.result);
      const testError = new Error('failure');

      class TestService {
        @AnyOnReturnHook(callback)
        failing() {
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass args, target, propertyKey, result, and descriptor to callback', () => {
      const callback = vi.fn((ctx: OnReturnContext) => ctx.result);

      class TestService {
        @AnyOnReturnHook(callback)
        add(a: number, b: number) {
          return a + b;
        }
      }

      const service = new TestService();
      service.add(3, 7);

      expect(callback).toHaveBeenCalledOnce();

      const [context] = callback.mock.calls[0];
      expect(context.argsObject).toEqual({ a: 3, b: 7 });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('add');
      expect(context.result).toBe(10);
      expect(context.descriptor).toBeDefined();
      expect(typeof context.descriptor.value).toBe('function');
    });
  });

  describe('applied to a class', () => {
    it('should fire callback after each method returns', () => {
      const callback = vi.fn((ctx: OnReturnContext) => ctx.result);

      @AnyOnReturnHook(callback)
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

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
});
