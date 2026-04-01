---
title: Preserve Async Optimizations When Flattening
impact: HIGH
paths:
  - "src/**/*.ts"
---

# Preserve Async Optimizations When Flattening

When replacing manual promise chains with `async/await`, do not erase existing fast-path optimizations that return the original promise unchanged when no async work is required. Keep the conditional bare-promise path to avoid unnecessary promise allocations and microtask overhead.

## Incorrect

Replacing conditional `.then`/`.catch` chaining with an unconditional `async` function that always awaits the promise, even when no hooks need to run.

```typescript
const runAsyncHooks = async <R>(
  promise: Promise<UnwrapPromise<R>>,
  context: HookContext,
  hooks: EffectHooks<R>,
): Promise<UnwrapPromise<R>> => {
  try {
    const value = await promise;
    if (hooks.onReturn) {
      return await hooks.onReturn({ ...context, result: value as UnwrapPromise<R> });
    }
    return value;
  } catch (error: unknown) {
    if (hooks.onError) {
      return await hooks.onError({ ...context, error });
    }
    throw error;
  } finally {
    if (hooks.finally) {
      await hooks.finally(context);
    }
  }
};
```

## Correct

Preserve the fast path that returns the original promise directly when none of the async lifecycle hooks are present, and only enter the `async` wrapper when needed.

```typescript
const runAsyncHooks = <R>(
  promise: Promise<UnwrapPromise<R>>,
  context: HookContext,
  hooks: EffectHooks<R>,
): Promise<UnwrapPromise<R>> => {
  if (!hooks.onReturn && !hooks.onError && !hooks.finally) {
    return promise;
  }

  return (async () => {
    try {
      const value = await promise;
      if (hooks.onReturn) {
        return await hooks.onReturn({ ...context, result: value as UnwrapPromise<R> });
      }
      return value;
    } catch (error: unknown) {
      if (hooks.onError) {
        return await hooks.onError({ ...context, error });
      }
      throw error;
    } finally {
      if (hooks.finally) {
        await hooks.finally(context);
      }
    }
  })();
};
```
