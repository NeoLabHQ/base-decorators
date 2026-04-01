---
title: Deduplication Must Not Change Feature Behavior
impact: HIGH
---

# Deduplication Must Not Change Feature Behavior

When tasked with code deduplication or structural refactoring, ONLY change code structure. Do NOT modify type signatures, add new features, or change test expectations. The behavioral contract must remain identical.

## Incorrect

The dedup task is conflated with a feature change. Type signatures are expanded and test files are modified.

```typescript
// Task: deduplicate finally blocks in effect-on-method.ts
// Agent also changes (WRONG - not requested):
export type OnInvokeHookType<R = unknown> = (
  context: HookContext,
) => void | Promise<void>;  // was: void
```

## Correct

Only the duplicated pattern is extracted. All types, tests, and behavior remain unchanged.

```typescript
// Task: deduplicate finally blocks
// Agent changes (CORRECT - structure only):
const runFinally = <R>(hooks: EffectHooks<R>, context: HookContext): void => {
  if (hooks.finally) {
    hooks.finally(context);
  }
};
```
