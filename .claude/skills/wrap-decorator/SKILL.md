---
name: Wrap Decorator
description: Design and implementation guide for the Wrap decorator primitive and its relationship to the Effect decorator in the base-decorators library
topics: typescript, decorators, method-wrapping, higher-order-functions, refactoring
created: 2026-04-08
updated: 2026-04-08
scratchpad: .specs/scratchpad/690c5e80.md
---

# Wrap Decorator

## Overview

`Wrap` is a lower-level decorator primitive that exposes raw method wrapping via a higher-order function. Unlike `Effect` (which provides lifecycle hooks), `Wrap` gives the user full control over execution flow by accepting a factory that returns a replacement function. `Effect` is rebuilt on top of `Wrap` by implementing the hooks lifecycle inside the factory.

---

## Key Concepts

- **WrapContext**: Decoration-time context plus runtime context (target, className) -- everything in `HookContext` except `args` and `argsObject`.
- **WrapFn**: The factory signature `(method, context: WrapContext) => (...args) => unknown`. Called per invocation with a `this`-bound original method.
- **HookContext extends WrapContext**: Interface extension -- `HookContext` adds `args` and `argsObject`. Zero new type assertions needed.
- **WrapOnMethod**: Low-level method decorator that calls the WrapFn factory per invocation.
- **WrapOnClass**: Class decorator that applies WrapOnMethod to all eligible prototype methods.
- **Wrap**: Unified decorator (like `Effect`) that dispatches to `WrapOnClass` or `WrapOnMethod` based on argument count.
- **WRAP_APPLIED_KEY**: Replaces `EFFECT_APPLIED_KEY` as the default sentinel symbol for double-wrap prevention.

---

## Documentation & References

| Resource | Description | Link |
|----------|-------------|------|
| TypeScript Decorators (legacy) | experimentalDecorators API reference | https://www.typescriptlang.org/docs/handbook/decorators.html |
| base-decorators source | Current implementation to refactor | /workspaces/base-decorators/src/ |
| base-decorators tests | Tests to update/rename | /workspaces/base-decorators/tests/ |
| Type safety rule | Must not increase as-cast count | /workspaces/base-decorators/.claude/rules/preserve-type-safety-during-refactoring.md |

---

## Recommended File Structure After Refactoring

| Old File | New File | Role |
|----------|----------|------|
| `src/effect-on-method.ts` | `src/wrap-on-method.ts` | Low-level method wrapper (WRAP_APPLIED_KEY, WrapOnMethod, copySymMeta) |
| `src/effect-on-class.ts` | `src/wrap-on-class.ts` | Class decorator using WrapOnMethod |
| `src/effect.decorator.ts` | `src/wrap.decorator.ts` + `src/effect.decorator.ts` | Wrap = primitive; Effect = hooks layer on top |
| `src/hook.types.ts` | `src/hook.types.ts` | Add WrapContext, WrapFn; HookContext extends WrapContext |
| `tests/EffectOnMethod.spec.ts` | `tests/WrapOnMethod.spec.ts` | Renamed tests |
| `tests/EffectOnClass.spec.ts` | `tests/WrapOnClass.spec.ts` | Renamed tests |
| `tests/effect-on-method-base.spec.ts` | `tests/wrap-on-method-base.spec.ts` | Internal helpers moved |

---

## Patterns & Best Practices

### Pattern 1: WrapContext as base interface

**When to use**: Always -- this is the foundational type split.
**Trade-offs**: Clean interface extension, no extra type assertions.

```typescript
export interface WrapContext {
  target: object;
  propertyKey: string | symbol;
  parameterNames: string[];
  className: string;
  descriptor: PropertyDescriptor;
}

export interface HookContext extends WrapContext {
  args: unknown[];
  argsObject: HookArgs;
}
```

### Pattern 2: Per-invocation factory with bound method

**When to use**: WrapOnMethod calls the WrapFn factory on each method invocation.
**Trade-offs**: Slight overhead per call; required for runtime `this`/`className` access.

```typescript
// Inside WrapOnMethod's wrapped function:
const wrapped = function(this: object, ...args: unknown[]) {
  const className = (this.constructor as { name: string }).name ?? '';
  const context: WrapContext = { target: this, propertyKey, parameterNames, className, descriptor };
  const boundMethod = originalMethod.bind(this);
  const wrappedFn = wrapFn(boundMethod, context);
  return wrappedFn(...args);
};
```

### Pattern 3: Effect as Wrap consumer

**When to use**: Effect delegates entirely to Wrap; hooks logic moves to effect.decorator.ts.
**Trade-offs**: Effect no longer imports from effect-on-method; hooks internals live in effect.decorator.ts.

```typescript
// In effect.decorator.ts -- Effect's internal wrap factory:
const effectWrapFn = (hooksOrFactory: HooksOrFactory<R>) =>
  (boundMethod: (...args: unknown[]) => unknown, wrapCtx: WrapContext) =>
    (...args: unknown[]): unknown => {
      const argsObject = buildArgsObject(wrapCtx.parameterNames, args);
      const context: HookContext = { ...wrapCtx, args, argsObject };
      const hooks = resolveHooks(hooksOrFactory, context);
      const executeMethod = attachHooks(boundMethod, args, context, hooks);
      if (hooks.onInvoke) {
        const invokeResult = hooks.onInvoke(context);
        if (invokeResult instanceof Promise) return invokeResult.then(executeMethod);
      }
      return executeMethod();
    };
```

### Pattern 4: Exclusion key propagation

**When to use**: Always -- WrapOnMethod sets the exclusion key; WrapOnClass checks it.
**Trade-offs**: Consistent with existing Effect behavior; WRAP_APPLIED_KEY is the new default.

```typescript
// WrapOnMethod sets exclusion key at decoration time
setMeta(exclusionKey, true, descriptor);

// WrapOnClass skips methods already marked
if (getMeta(exclusionKey, descriptor) === true) continue;
```

---

## User-Facing API

### Wrap decorator basic usage

```typescript
import { Wrap } from 'base-decorators';
import type { WrapContext } from 'base-decorators';

export const Log = () => Wrap((method, context: WrapContext) => {
  console.log('method called is', context.propertyKey);
  return (...args: unknown[]) => {
    console.log('method called with', args);
    const result = method(...args);
    console.log('method returned', result);
    return result;
  };
});

class Calculator {
  @Log()
  add(a: number, b: number) {
    return a + b;
  }
}
```

### Async Wrap usage

```typescript
export const AsyncTimer = () => Wrap((method, context: WrapContext) => {
  return async (...args: unknown[]) => {
    const start = Date.now();
    const result = await method(...args);
    console.log(`${String(context.propertyKey)} took ${Date.now() - start}ms`);
    return result;
  };
});
```

### Effect continues to work unchanged

```typescript
import { Effect } from 'base-decorators';

class Service {
  @Effect({
    onInvoke: ({ args }) => console.log('called with', args),
    onReturn: ({ result }) => { console.log('result:', result); return result; },
  })
  compute(x: number) { return x * 2; }
}
```

---

## Internal Helper Migration

These functions move FROM `effect-on-method.ts` TO `effect.decorator.ts`:

| Function | Current Location | New Location |
|----------|-----------------|--------------|
| `buildArgsObject` | `effect-on-method.ts` | `effect.decorator.ts` |
| `attachHooks` | `effect-on-method.ts` | `effect.decorator.ts` |
| `resolveHooks` | `effect-on-method.ts` (private) | `effect.decorator.ts` (private) |
| `chainAsyncHooks` | `effect-on-method.ts` (private) | `effect.decorator.ts` (private) |
| `wrapFunction` | `effect-on-method.ts` | Eliminated -- superseded by WrapOnMethod + effectWrapFn |
| `copySymMeta` | `effect-on-method.ts` (private) | `wrap-on-method.ts` (private) |

Note: `attachHooks` signature changes -- the `thisArg` parameter is removed since `Wrap` passes a pre-bound method.

---

## Common Pitfalls & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| WrapFn factory called at decoration time instead of per invocation | High | Factory must be inside the `wrapped = function(this)` closure |
| method arg is unbound causing lost this context | Med | Pre-bind method to `this` before passing to factory |
| `as` type assertion count increases during refactoring | Med | Use interface extension (`HookContext extends WrapContext`) not structural casting |
| Tests importing from old file paths break | High | Update all import paths in test files |
| copySymMeta lost during refactoring | High | Keep in wrap-on-method.ts and call it from WrapOnMethod |
| attachHooks previously received thisArg separately | Med | Remove thisArg param; receive pre-bound method from WrapOnMethod |
| effect-on-method-base.spec.ts imports wrapFunction/attachHooks | High | Update test to import from new location or test via Effect |

---

## Export Checklist for index.ts

After refactoring, `src/index.ts` should export:

```typescript
// Wrap primitive (new)
export * from './wrap-on-method';   // WrapOnMethod, WRAP_APPLIED_KEY
export * from './wrap-on-class';    // WrapOnClass
export * from './wrap.decorator';   // Wrap

// Effect (hooks layer on top of Wrap)
export * from './effect.decorator'; // Effect, buildArgsObject (if still public)

// Types
export type * from './hook.types';  // WrapContext, WrapFn, HookContext, etc.

// Meta utilities
export * from './set-meta.decorator';

// Convenience hook decorators
export * from './on-invoke.hook';
export * from './on-return.hook';
export * from './on-error.hook';
export * from './finally.hook';
```

---

## Type Safety Checklist

Before finalizing implementation, count `as` assertions in refactored files vs. originals:

- `effect-on-method.ts` baseline: approximately 6-7 assertions (descriptor.value cast, copySymMeta casts)
- These assertions move to `wrap-on-method.ts` (copySymMeta, descriptor.value cast)
- `effect.decorator.ts` gains internal hook logic but HookContext extends WrapContext avoids new casts
- Final count must be equal or fewer than baseline

---

## Sources & Verification

| Source | Type | Last Verified |
|--------|------|---------------|
| `/workspaces/base-decorators/src/effect-on-method.ts` | Primary (project source) | 2026-04-08 |
| `/workspaces/base-decorators/src/effect-on-class.ts` | Primary (project source) | 2026-04-08 |
| `/workspaces/base-decorators/src/effect.decorator.ts` | Primary (project source) | 2026-04-08 |
| `/workspaces/base-decorators/src/hook.types.ts` | Primary (project source) | 2026-04-08 |
| `/workspaces/base-decorators/tests/*.spec.ts` | Primary (project tests) | 2026-04-08 |
| `.claude/rules/preserve-type-safety-during-refactoring.md` | Project rules | 2026-04-08 |
| Task file: `.specs/tasks/draft/add-wrap-decorator.feature.md` | Task definition | 2026-04-08 |

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-04-08 | Initial creation for task: Add wrap decorator |
