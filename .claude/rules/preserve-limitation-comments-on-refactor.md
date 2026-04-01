---
title: Preserve Limitation Comments on Refactor
impact: MEDIUM
---

# Preserve Limitation Comments on Refactor

When refactoring code, relocate comments that document intentional behaviors, known limitations, or architectural trade-offs to the equivalent new code location. Deleting these comments loses critical context for future maintainers.

## Incorrect

A comment explaining a known double-fire behavior is dropped during a refactor because it was attached to old callback plumbing.

```typescript
// Old code contained:
// If an error occurs in the onReturn hook, `finally` will be triggered 2 times.
// Intentional architecture choice due to TS limitations
return handleSyncSuccess(result, context, hooks);

// After refactor the comment is gone, even though the behavior still exists:
const runSyncSuccess = <R>(result: R, context: HookContext, hooks: EffectHooks<R>): MaybeAsync<R> => {
  try {
    return hooks.onReturn
      ? (hooks.onReturn({ ...context, result: result as UnwrapPromise<R> }) as MaybeAsync<R>)
      : (result as MaybeAsync<R>);
  } finally {
    if (hooks.finally) {
      hooks.finally(context);
    }
  }
};
```

## Correct

The same comment is preserved next to the equivalent logic so the limitation remains documented.

```typescript
const runSyncSuccess = <R>(result: R, context: HookContext, hooks: EffectHooks<R>): MaybeAsync<R> => {
  // If an error occurs in the onReturn hook, `finally` will be triggered 2 times.
  // Intentional architecture choice due to TS limitations
  try {
    return hooks.onReturn
      ? (hooks.onReturn({ ...context, result: result as UnwrapPromise<R> }) as MaybeAsync<R>)
      : (result as MaybeAsync<R>);
  } finally {
    if (hooks.finally) {
      hooks.finally(context);
    }
  }
};
```
