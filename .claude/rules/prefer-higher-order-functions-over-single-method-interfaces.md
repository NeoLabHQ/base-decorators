---
title: Prefer Higher-Order Functions Over Single-Method Interfaces
impact: MEDIUM
paths:
  - "src/**/*.ts"
---

# Prefer Higher-Order Functions Over Single-Method Interfaces

When refactoring for architectural improvement, prefer plain functions and higher-order functions over interfaces or classes with only one method. A single-method interface is usually just a function in disguise and adds unnecessary object allocation and cognitive overhead without improving testability or decoupling.

## Incorrect

Introducing a single-method interface and object literal wrapper instead of a plain higher-order function.

```typescript
interface MethodInvocation<R> {
  invoke(self: object, args: unknown[]): unknown;
}

const createMethodInvocation = <R>(
  originalMethod: Function,
  parameterNames: string[],
): MethodInvocation<R> => {
  return {
    invoke(self, args) {
      return originalMethod.apply(self, args);
    },
  };
};
```

## Correct

Return a plain function directly; the closure already captures the decoration-time state.

```typescript
const createInvoker = (
  originalMethod: Function,
  parameterNames: string[],
): ((self: object, args: unknown[]) => unknown) => {
  return (self, args) => {
    return originalMethod.apply(self, args);
  };
};
```
