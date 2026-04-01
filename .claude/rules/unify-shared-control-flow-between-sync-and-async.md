---
title: Unify Shared Control Flow Between Sync and Async Paths
impact: HIGH
paths:
  - "src/**/*.ts"
---

# Unify Shared Control Flow Between Sync and Async Paths

When refactoring code that has both synchronous and asynchronous variants, extract the shared control-flow logic (e.g., try → success → catch → finally) into a common abstraction. Do not duplicate the entire orchestration structure just because the return types or await points differ.

## Incorrect

Duplicating the full try/catch/finally orchestration in separate sync and async functions.

```typescript
const runSync = <R>(
  original: () => R,
  pipeline: SyncPipeline<R>,
): MaybeAsync<R> => {
  try {
    return pipeline.success(original());
  } catch (e) {
    return pipeline.error(e);
  } finally {
    pipeline.cleanup();
  }
};

const runAsync = <R>(
  promise: Promise<UnwrapPromise<R>>,
  pipeline: AsyncPipeline<R>,
): Promise<UnwrapPromise<R>> => {
  return (async () => {
    try {
      return await pipeline.success(await promise);
    } catch (e) {
      return await pipeline.error(e);
    } finally {
      await pipeline.cleanup();
    }
  })();
};
```

## Correct

Extract a single orchestrator that accepts the primitive operations as parameters, or use a polymorphic pipeline so the runner logic is written once.

```typescript
const runPipeline = <T>(
  execute: () => T,
  handleSuccess: (value: T) => unknown,
  handleError: (err: unknown) => unknown,
  cleanup: () => void,
): unknown => {
  try {
    return handleSuccess(execute());
  } catch (e) {
    return handleError(e);
  } finally {
    cleanup();
  }
};
```
