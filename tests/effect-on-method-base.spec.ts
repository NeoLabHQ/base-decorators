import { describe, it, expect, vi } from 'vitest';

import { attachHooks, wrapFunction } from '../src/effect-on-method';
import type { EffectHooks, HookContext, OnReturnContext } from '../src/hook.types';

const makeDescriptor = (fn: (...args: unknown[]) => unknown): PropertyDescriptor => ({
  value: fn,
  writable: true,
  enumerable: true,
  configurable: true,
});

const makeContext = (overrides: Partial<HookContext> = {}): HookContext => {
  const original = () => undefined;
  return {
    args: [],
    argsObject: undefined,
    target: {},
    propertyKey: 'method',
    parameterNames: [],
    className: 'TestCls',
    descriptor: makeDescriptor(original),
    ...overrides,
  };
};

describe('attachHooks', () => {
  it('runs the original method and returns its result when hooks are empty', () => {
    const original = vi.fn((...args: unknown[]) => (args[0] as number) + 1);
    const thisArg = {};
    const args = [2] as unknown[];
    const context = makeContext({ args, target: thisArg });

    const run = attachHooks(original, thisArg, args, context, {});
    expect(run()).toBe(3);
    expect(original).toHaveBeenCalledWith(2);
  });

  it('applies onReturn on sync success', () => {
    const original = () => 'a';
    const context = makeContext();
    const run = attachHooks(original, {}, [], context, {
      onReturn: ({ result }) => `${result}b`,
    });
    expect(run()).toBe('ab');
  });

  it('applies onError when the original throws', () => {
    const original = () => {
      throw new Error('fail');
    };
    const context = makeContext();
    const run = attachHooks(original, {}, [], context, {
      onError: () => 'recovered',
    });
    expect(run()).toBe('recovered');
  });

  it('calls finally on sync success', () => {
    const finallyHook = vi.fn();
    const original = () => 1;
    const context = makeContext();
    const run = attachHooks(original, {}, [], context, { finally: finallyHook });
    expect(run()).toBe(1);
    expect(finallyHook).toHaveBeenCalledTimes(1);
    expect(finallyHook).toHaveBeenCalledWith(context);
  });

  it('resolves async path through chainAsyncHooks', async () => {
    const original = () => Promise.resolve(10);
    const context = makeContext();
    const run = attachHooks(original, {}, [], context, {
      onReturn: ({ result }: OnReturnContext<number>) => result * 2,
    });
    await expect(run()).resolves.toBe(20);
  });
});

describe('wrapFunction', () => {
  it('binds this and args like a decorated method', () => {
    class C {
      suffix = '!';
    }
    const original = function (this: C, name: string) {
      return `${name}${this.suffix}`;
    };
    const descriptor = makeDescriptor(original as (...args: unknown[]) => unknown);
    const wrapped = wrapFunction(
      original as (...args: unknown[]) => unknown,
      ['name'],
      'greet',
      descriptor,
      {},
    );

    const instance = new C();
    expect(wrapped.call(instance, 'hi')).toBe('hi!');
  });

  it('builds argsObject from parameter names', () => {
    let seen: HookContext | undefined;
    const original = () => 0;
    const descriptor = makeDescriptor(original);
    const wrapped = wrapFunction(original, ['a', 'b'], 'm', descriptor, {
      onInvoke: (ctx) => {
        seen = ctx;
      },
    });

    wrapped.call({}, 1, 2);
    expect(seen?.argsObject).toEqual({ a: 1, b: 2 });
    expect(seen?.parameterNames).toEqual(['a', 'b']);
    expect(seen?.propertyKey).toBe('m');
  });

  it('runs async onInvoke then the original', async () => {
    const order: string[] = [];
    const original = () => {
      order.push('original');
      return 1;
    };
    const descriptor = makeDescriptor(original);
    const wrapped = wrapFunction(original, [], 'm', descriptor, {
      onInvoke: async () => {
        order.push('onInvoke');
      },
    });

    await wrapped.call({});
    expect(order).toEqual(['onInvoke', 'original']);
  });

  it('uses hooks factory with per-call context', () => {
    const original = (n: number) => n;
    const descriptor = makeDescriptor(original as (...args: unknown[]) => unknown);
    const factory = vi.fn((_ctx: HookContext): EffectHooks<number> => ({
      onReturn: ({ result }: OnReturnContext<number>) => result + 1,
    }));
    const wrapped = wrapFunction(
      original as (...args: unknown[]) => unknown,
      ['n'],
      'm',
      descriptor,
      factory,
    );

    expect(wrapped.call({}, 5)).toBe(6);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory.mock.calls[0]?.[0]?.args).toEqual([5]);
  });
});
