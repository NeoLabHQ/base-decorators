import { describe, it, expect, vi } from 'vitest';

import { FinallyHook } from '../src/finally.hook';
import type { FinallyHookType } from '../src/hook.types';

/** Permissive FinallyHook wrapper for runtime-focused tests where type inference is not under test. */
const AnyFinallyHook = (callback: FinallyHookType<object, any[], any>, exclusionKey?: symbol) =>
  FinallyHook<object, any[], any>(callback, exclusionKey);

describe('FinallyHook', () => {
  describe('applied to a method', () => {
    it('should fire callback after sync method succeeds', () => {
      const callOrder: string[] = [];
      const callback = vi.fn(() => { callOrder.push('finally'); });

      class TestService {
        @AnyFinallyHook(callback)
        greet(name: string) {
          callOrder.push('original');
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'finally']);
    });

    it('should fire callback after sync method throws', () => {
      const callOrder: string[] = [];
      const testError = new Error('failure');
      const callback = vi.fn(() => { callOrder.push('finally'); });

      class TestService {
        @AnyFinallyHook(callback)
        failing() {
          callOrder.push('original');
          throw testError;
        }
      }

      const service = new TestService();
      expect(() => service.failing()).toThrow(testError);
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'finally']);
    });

    it('should fire callback after async method resolves', async () => {
      const callOrder: string[] = [];
      const callback = vi.fn(() => { callOrder.push('finally'); });

      class TestService {
        @AnyFinallyHook(callback)
        async fetchData(id: number) {
          callOrder.push('original');
          return { id };
        }
      }

      const service = new TestService();
      const result = await service.fetchData(42);

      expect(result).toEqual({ id: 42 });
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'finally']);
    });

    it('should fire callback after async method rejects', async () => {
      const callOrder: string[] = [];
      const testError = new Error('async failure');
      const callback = vi.fn(() => { callOrder.push('finally'); });

      class TestService {
        @AnyFinallyHook(callback)
        async failing() {
          callOrder.push('original');
          throw testError;
        }
      }

      const service = new TestService();
      await expect(service.failing()).rejects.toThrow(testError);
      expect(callback).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['original', 'finally']);
    });

    it('should pass args, target, propertyKey, and descriptor to callback', () => {
      const callback = vi.fn();

      class TestService {
        @AnyFinallyHook(callback)
        doWork(a: number, b: string) {
          return `${a}-${b}`;
        }
      }

      const service = new TestService();
      service.doWork(1, 'test');

      expect(callback).toHaveBeenCalledOnce();

      const [context] = callback.mock.calls[0];
      expect(context.argsObject).toEqual({ a: 1, b: 'test' });
      expect(context.target).toBe(service);
      expect(context.propertyKey).toBe('doWork');
      expect(context.descriptor).toBeDefined();
      expect(typeof context.descriptor.value).toBe('function');
    });
  });

  describe('applied to a class', () => {
    it('should fire callback after each method call regardless of outcome', () => {
      const callback = vi.fn();
      const testError = new Error('method B error');

      @AnyFinallyHook(callback)
      class TestService {
        methodA() {
          return 'a';
        }

        methodB() {
          throw testError;
        }
      }

      const service = new TestService();
      service.methodA();
      expect(() => service.methodB()).toThrow(testError);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not fire callback during construction', () => {
      const callback = vi.fn();

      @AnyFinallyHook(callback)
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
      expect(callback).not.toHaveBeenCalled();

      service.doWork();
      expect(callback).toHaveBeenCalledOnce();
    });
  });
});
