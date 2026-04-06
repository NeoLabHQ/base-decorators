---
title: Preserve Type Safety During Refactoring
impact: MEDIUM
paths:
  - "**/*.ts"
---

# Preserve Type Safety During Refactoring

Count `as` type assertions before and after any refactoring. The refactored code must have equal or fewer assertions than the original. Increasing assertion count indicates the new abstractions fight the type system rather than working with it.

## Incorrect

Merging two typed functions into one with an `unknown` parameter, requiring new `as` casts at every usage site.

```typescript
// Original: 2 functions, 0 extra assertions
const handleSuccess = <R>(result: R, hooks: Hooks<R>): R => {
  return hooks.onReturn ? hooks.onReturn(result) : result;
};
const handleError = <R>(error: unknown, hooks: Hooks<R>): R => {
  if (hooks.onError) return hooks.onError(error);
  throw error;
};

// Refactored: 1 function, but 3 new assertions
const settle = <R>(succeeded: boolean, value: unknown, hooks: Hooks<R>): R => {
  if (succeeded) {
    return hooks.onReturn
      ? (hooks.onReturn(value as R) as R)  // 2 new assertions
      : (value as R);                       // 1 new assertion
  }
  // ...
};
```

## Correct

Use overloads or a discriminated union to preserve type information without additional casts.

```typescript
type Outcome<R> =
  | { succeeded: true; value: R }
  | { succeeded: false; error: unknown };

const settle = <R>(outcome: Outcome<R>, hooks: Hooks<R>): R => {
  if (outcome.succeeded) {
    return hooks.onReturn
      ? hooks.onReturn(outcome.value)  // no cast needed, value is R
      : outcome.value;
  }
  if (hooks.onError) return hooks.onError(outcome.error);
  throw outcome.error;
};
```
