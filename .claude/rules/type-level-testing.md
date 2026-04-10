---
title: Verify Type Changes With Compile-Time Tests
impact: HIGH
paths:
  - "tests/**/*.ts"
  - "src/**/*.ts"
---

# Verify Type Changes With Compile-Time Tests

When adding or modifying generic type parameters, include compile-time type verification tests using `expectTypeOf` (from vitest) or `@ts-expect-error` comments. Runtime assertions alone cannot detect silent type degradation where generics fall back to defaults like `unknown`.

## Incorrect

Type tests that only use runtime assertions -- these pass even if generics silently degrade to `unknown`.

```typescript
it('HookContext accepts generic parameters', () => {
  const ctx: HookContext<MyService, [number], string> = { /* ... */ };
  // This runtime assertion passes regardless of whether generics work
  expect(ctx.target).toBeDefined();
  expect(ctx.args).toEqual([42]);
});
```

## Correct

Type tests that include compile-time verification and negative cases.

```typescript
import { expectTypeOf } from 'vitest';

it('HookContext infers target type from generic parameter', () => {
  const ctx: HookContext<MyService, [number], string> = { /* ... */ };

  // Positive: verify inferred types at compile time
  expectTypeOf(ctx.target).toEqualTypeOf<MyService>();
  expectTypeOf(ctx.args).toEqualTypeOf<[number]>();

  // Negative: verify wrong types are rejected
  // @ts-expect-error - target should not accept string
  const bad: HookContext<string> = { /* ... */ };
});
```
