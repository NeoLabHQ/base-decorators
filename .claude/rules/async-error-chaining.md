---
title: Use Unified Promise Chains for Async Error Handling
impact: CRITICAL
---

# Use Unified Promise Chains for Async Error Handling

Promise error handlers must be part of the same consumed chain that is returned to the caller. Attaching `.catch()` or `.then()` as a side effect — without consuming the resulting promise — creates unhandled rejections and loses recovery values from error handlers.

## Incorrect

The `.catch()` is attached as a side effect. Its result (possibly a rejection or recovery value) is never consumed. When the handler re-throws, the rejection becomes unhandled. When it returns a recovery, the recovery is lost.

\`\`\`typescript
const onInvokeResult = hooks.onInvoke?.(context);
if (onInvokeResult instanceof Promise) {
  // Detached .catch() — nobody consumes the result
  onInvokeResult.catch((error) => {
    return handleAsyncOnInvokeError(error, context, hooks) as never;
  });
  // This .then() never fires on rejection
  return onInvokeResult.then(() => runMethod(this, args, originalMethod, context, hooks));
}
\`\`\`

## Correct

All handlers are part of a single consumed chain. The `.catch()` handles errors (onError runs, recovery returned), and `.then()` runs only on success. The entire chain result is returned.

\`\`\`typescript
const onInvokeResult = hooks.onInvoke?.(context);
if (onInvokeResult instanceof Promise) {
  return onInvokeResult
    .then(() => runMethod(this, args, originalMethod, context, hooks))
    .catch((error) => handleAsyncOnInvokeError(error, context, hooks));
}
\`\`\`
