---
title: Codebase Impact Analysis - Add wrap decorator
task_file: .specs/tasks/draft/add-wrap-decorator.feature.md
scratchpad: .specs/scratchpad/a705bfb8.md
created: 2026-04-08
status: complete
---

# Codebase Impact Analysis: Add wrap decorator

## Summary

- **Files to Modify**: 4 files (effect.decorator.ts, hook.types.ts, index.ts, README.md)
- **Files to Create**: 5 files (wrap-on-method.ts, wrap-on-class.ts, wrap.decorator.ts, WrapOnMethod.spec.ts, WrapOnClass.spec.ts, Wrap.spec.ts)
- **Files to Delete**: 2 source files (effect-on-method.ts, effect-on-class.ts) + 3 test files replaced
- **Test Files Affected**: 10 files (3 deleted/rewritten, 1 updated, 6 verified)
- **Risk Level**: High (breaking change: removes EffectOnMethod, EffectOnClass, EFFECT_APPLIED_KEY from public API)

---

## Files to be Modified/Created

### Primary Changes

```
src/
├── wrap-on-method.ts              # NEW (internal): Core wrapping primitive, not exported from index.ts
│                                  #   Contains: WRAP_APPLIED_KEY, WrapOnMethod, copySymMeta (private)
│                                  #   Imports: setMeta, SYM_META_PROP (set-meta.decorator);
│                                  #            getParameterNames (getParameterNames);
│                                  #            WrapFn, WrapContext (hook.types)
│
├── wrap-on-class.ts               # NEW (internal): Class-level iteration, not exported from index.ts
│                                  #   Contains: WrapOnClass
│                                  #   Imports: getMeta (set-meta.decorator); WrapFn (hook.types);
│                                  #            WrapOnMethod, WRAP_APPLIED_KEY (wrap-on-method)
│
├── wrap.decorator.ts              # NEW (public): Dispatches to WrapOnClass or WrapOnMethod
│                                  #   Contains: Wrap
│                                  #   Exported from index.ts
│
├── effect-on-method.ts            # DELETE: Logic migrated to wrap-on-method.ts + effect.decorator.ts
├── effect-on-class.ts             # DELETE: Logic migrated to wrap-on-class.ts
│
├── effect.decorator.ts            # UPDATE: Rebuild Effect on top of Wrap; receive hook logic here
│                                  #   Gains: buildArgsObject, attachHooks (unchanged signature),
│                                  #          resolveHooks, chainAsyncHooks (all moved from effect-on-method.ts)
│                                  #   Imports: WrapFn, WrapContext, HooksOrFactory from hook.types;
│                                  #            Wrap (or WrapOnMethod/WrapOnClass) from wrap layer
│
├── hook.types.ts                  # UPDATE: Add WrapContext and WrapFn; HookContext extends WrapContext
│
└── index.ts                       # UPDATE: Remove effect-on-method/effect-on-class exports;
                                   #         Add wrap.decorator export; keep all others
```

### Test Changes

```
tests/
├── WrapOnMethod.spec.ts           # NEW: Covers WrapOnMethod lifecycle, sync/async, metadata, exclusionKey, WRAP_APPLIED_KEY
├── WrapOnClass.spec.ts            # NEW: Covers prototype iteration, skip logic, getters, exclusionKey, WRAP_APPLIED_KEY
├── Wrap.spec.ts                   # NEW: Covers class+method dispatch, user-provided WrapFn shape, sync/async
├── EffectOnMethod.spec.ts         # DELETE: No longer valid (EffectOnMethod, EFFECT_APPLIED_KEY removed)
├── EffectOnClass.spec.ts          # DELETE: No longer valid (EffectOnClass, EffectOnMethod removed)
├── effect-on-method-base.spec.ts  # DELETE/REWRITE: Tests wrapFunction and attachHooks by old import path;
│                                  #   wrapFunction is eliminated; attachHooks moves to effect.decorator.ts
├── Effect.spec.ts                 # VERIFY: Interface preserved; error message in Effect guard may stay same
├── OnInvokeHook.spec.ts           # VERIFY: OnInvokeHook delegates to Effect (unchanged)
├── OnReturnHook.spec.ts           # VERIFY: OnReturnHook delegates to Effect (unchanged)
├── OnErrorHook.spec.ts            # VERIFY: OnErrorHook delegates to Effect (unchanged)
└── FinallyHook.spec.ts            # VERIFY: FinallyHook delegates to Effect (unchanged)
```

### Documentation Updates

```
README.md                          # UPDATE: Quick Start uses Wrap; How It Works covers Wrap as primitive;
                                   #         add async Wrap usage example; update API reference table
```

---

## Useful Resources for Implementation

### Pattern References

```
src/
├── effect.decorator.ts            # Dispatcher pattern to replicate for wrap.decorator.ts
├── effect-on-method.ts            # wrapFunction (lines 121-155), attachHooks (lines 164-196),
│                                  # copySymMeta (lines 208-229) — all to adapt for wrap layer
└── effect-on-class.ts             # Prototype iteration pattern (lines 56-77) for WrapOnClass
```

---

## Key Interfaces and Contracts

### Types to Create/Modify in `src/hook.types.ts`

**Before** (`src/hook.types.ts:12-27`):

```typescript
interface HookContext {
  args: unknown[];
  argsObject: HookArgs;
  target: object;
  propertyKey: string | symbol;
  parameterNames: string[];
  className: string;
  descriptor: PropertyDescriptor;
}
```

**After** — WrapContext as base, HookContext extends it:

```typescript
// New base (no args/argsObject)
interface WrapContext {
  target: object;
  propertyKey: string | symbol;
  parameterNames: string[];
  className: string;
  descriptor: PropertyDescriptor;
}

// HookContext extends WrapContext — same shape as before, zero new `as` casts needed
interface HookContext extends WrapContext {
  args: unknown[];
  argsObject: HookArgs;
}

// New function type for Wrap
type WrapFn<R = unknown> = (
  method: (...args: unknown[]) => unknown,
  context: WrapContext,
) => (...args: unknown[]) => R;
```

### Functions/Methods to Modify

| Location | Name | Current Signature | Change Required |
|----------|------|-------------------|-----------------|
| `src/effect-on-method.ts:48` | `EffectOnMethod` | `(hooksOrFactory, exclusionKey?) => MethodDecorator` | DELETE — replaced by internal `WrapOnMethod` |
| `src/effect-on-class.ts:50` | `EffectOnClass` | `(hooks, exclusionKey?) => ClassDecorator` | DELETE — replaced by internal `WrapOnClass` |
| `src/effect.decorator.ts:48` | `Effect` | `(hooks, exclusionKey?) => ClassDecorator & MethodDecorator` | UPDATE — rebuild to delegate to Wrap; move hook lifecycle logic here |
| `src/effect-on-method.ts:164` | `attachHooks` | `(originalMethod, thisArg, args, context, hooks) => () => unknown` | MOVE to `effect.decorator.ts` with **unchanged signature** |
| `src/effect-on-method.ts:98` | `buildArgsObject` | `(parameterNames, args) => Record` | MOVE to `effect.decorator.ts` |
| `src/effect-on-method.ts:121` | `wrapFunction` | `(originalMethod, parameterNames, propertyKey, descriptor, hooksOrFactory) => fn` | ELIMINATE — superseded by WrapOnMethod internals + effectWrapFn |

### New Functions to Create

| Location | Name | Signature | Description |
|----------|------|-----------|-------------|
| `src/wrap-on-method.ts` | `WRAP_APPLIED_KEY` | `unique symbol` | Replaces EFFECT_APPLIED_KEY as default sentinel (internal only) |
| `src/wrap-on-method.ts` | `WrapOnMethod` | `(wrapFn: WrapFn<R>, exclusionKey?) => MethodDecorator` | Core wrapping primitive — internal, not in index.ts |
| `src/wrap-on-class.ts` | `WrapOnClass` | `(wrapFn: WrapFn<R>, exclusionKey?) => ClassDecorator` | Iterates prototype, applies WrapOnMethod — internal, not in index.ts |
| `src/wrap.decorator.ts` | `Wrap` | `(wrapFn: WrapFn<R>, exclusionKey?) => ClassDecorator & MethodDecorator` | Public dispatcher |

### Private Helper Migration

| Function | Source File | Destination | Visibility |
|----------|-------------|-------------|------------|
| `copySymMeta` | `effect-on-method.ts:208` | `wrap-on-method.ts` | private |
| `resolveHooks` | `effect-on-method.ts:237` | `effect.decorator.ts` | private |
| `chainAsyncHooks` | `effect-on-method.ts:253` | `effect.decorator.ts` | private |
| `buildArgsObject` | `effect-on-method.ts:98` | `effect.decorator.ts` | private (internalized) |
| `attachHooks` | `effect-on-method.ts:164` | `effect.decorator.ts` | private (internalized) |

Note on `attachHooks`: the signature remains unchanged (`originalMethod, thisArg, args, context, hooks`). When called from Effect's internal WrapFn factory, `thisArg` and `target` are the same object because the method is called via `originalMethod.apply(thisArg, args)`. The signature is not simplified — the existing logic is moved as-is.

### Classes/Components Affected

| Location | Name | Change Required |
|----------|------|-----------------|
| `src/hook.types.ts:12` | `HookContext` | Now extends `WrapContext`; `args` and `argsObject` remain here |
| `src/hook.types.ts` | `WrapContext` | NEW — base interface without args/argsObject |
| `src/hook.types.ts` | `WrapFn` | NEW type alias |

---

## Integration Points

Files that interact with affected code and may need updates:

| File | Relationship | Impact | Action Needed |
|------|--------------|--------|---------------|
| `src/on-invoke.hook.ts:1` | Imports and calls `Effect` | Low | No change — Effect interface is preserved |
| `src/on-return.hook.ts:1` | Imports and calls `Effect` | Low | No change |
| `src/on-error.hook.ts:1` | Imports and calls `Effect` | Low | No change |
| `src/finally.hook.ts:1` | Imports and calls `Effect` | Low | No change |
| `src/getParameterNames.ts` | Required by wrap-on-method.ts | Low | No change — just imported from new location |
| `src/index.ts:1-13` | Re-exports all modules | High | Remove effect-on-method and effect-on-class exports; add wrap.decorator export |
| `tests/Effect.spec.ts:3` | Imports `Effect`, `SetMeta`, `getMeta`, `EffectHooks` | Low | VERIFY tests still pass |
| `tests/OnInvokeHook.spec.ts` | Imports `OnInvokeHook` | Low | VERIFY — delegates to Effect, unchanged |
| `tests/OnReturnHook.spec.ts` | Imports `OnReturnHook` | Low | VERIFY — delegates to Effect, unchanged |
| `tests/OnErrorHook.spec.ts` | Imports `OnErrorHook` | Low | VERIFY — delegates to Effect, unchanged |
| `tests/FinallyHook.spec.ts` | Imports `FinallyHook` | Low | VERIFY — delegates to Effect, unchanged |
| `tests/SetMeta.spec.ts` | Imports from `set-meta.decorator` | Low | VERIFY — module unchanged |
| `tests/getParameterNames.spec.ts` | Imports `getParameterNames` | Low | VERIFY — module unchanged |
| `tests/EffectOnMethod.spec.ts:6` | Imports `EffectOnMethod`, `EFFECT_APPLIED_KEY` | High | DELETE — replace with WrapOnMethod.spec.ts |
| `tests/EffectOnClass.spec.ts:4` | Imports `EffectOnClass`, `EffectOnMethod`, `EFFECT_APPLIED_KEY` | High | DELETE — replace with WrapOnClass.spec.ts |
| `tests/effect-on-method-base.spec.ts:3` | Imports `attachHooks`, `wrapFunction` from effect-on-method | High | DELETE/REWRITE — wrapFunction eliminated; attachHooks moves to effect.decorator.ts |

---

## Similar Implementations

### Pattern 1: Current Effect Dispatcher

- **Location**: `src/effect.decorator.ts`
- **Why relevant**: `wrap.decorator.ts` follows the identical `propertyKey === undefined` dispatch pattern
- **Key files**:
  - `src/effect.decorator.ts:55-72` — dispatch logic to replicate, replace `EffectOnClass`/`EffectOnMethod` calls with `WrapOnClass`/`WrapOnMethod`

### Pattern 2: EffectOnMethod Core Wrapping

- **Location**: `src/effect-on-method.ts`
- **Why relevant**: WrapOnMethod is the direct successor; copySymMeta, setMeta(exclusionKey) pattern is identical
- **Key files**:
  - `src/effect-on-method.ts:208-229` — `copySymMeta` to copy verbatim to `wrap-on-method.ts`
  - `src/effect-on-method.ts:48-78` — decorator factory pattern to replicate in `WrapOnMethod`

### Pattern 3: EffectOnClass Prototype Iteration

- **Location**: `src/effect-on-class.ts`
- **Why relevant**: WrapOnClass follows identical `getOwnPropertyNames` + `isPlainMethod` + `shouldSkipMethod` guards
- **Key files**:
  - `src/effect-on-class.ts:56-77` — iteration body to copy into `WrapOnClass`; guard functions stay private

---

## Test Coverage

### Existing Tests to Update

| Test File | Tests Affected | Update Required |
|-----------|----------------|-----------------|
| `tests/EffectOnMethod.spec.ts` | All (1013 lines, 40+ tests) | DELETE and rewrite as `WrapOnMethod.spec.ts` using WrapFn API |
| `tests/EffectOnClass.spec.ts` | All (482 lines) | DELETE and rewrite as `WrapOnClass.spec.ts` |
| `tests/effect-on-method-base.spec.ts` | All — imports `wrapFunction`, `attachHooks` by path | REWRITE or DELETE — wrapFunction eliminated; test attachHooks via effect.decorator.ts if kept exported, else test via Effect |
| `tests/Effect.spec.ts` | Possibly the "unsupported context" error guard (line 315) | VERIFY — message likely stays identical |

### New Tests Needed

| Test Type | Location | Coverage Target |
|-----------|----------|-----------------|
| Unit | `tests/WrapOnMethod.spec.ts` | WrapFn called per invocation, WRAP_APPLIED_KEY set, copySymMeta, exclusionKey, sync/async, this binding |
| Unit | `tests/WrapOnClass.spec.ts` | Prototype iteration, skip constructor/getters, WRAP_APPLIED_KEY skip, exclusionKey, double-wrap prevention |
| Unit | `tests/Wrap.spec.ts` | Class+method dispatch, user-provided WrapFn receives bound method + WrapContext, sync/async interop |

---

## Risk Assessment

### High Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| `this` binding in WrapOnMethod | User's WrapFn must receive a pre-bound method; omitting `originalMethod.bind(this)` causes `this === undefined` inside user's wrapper | Bind explicitly: `const boundMethod = originalMethod.bind(this)` before calling `wrapFn(boundMethod, context)` |
| Effect rebuilt on Wrap | hooks logic (attachHooks, chainAsyncHooks, resolveHooks) must be moved faithfully; any omission breaks all lifecycle behavior | Copy functions exactly; only change import paths; run full test suite |
| Type safety NFR (hard constraint) | `.claude/rules/preserve-type-safety-during-refactoring.md` requires equal or fewer `as` assertions post-refactor. Baseline: **15 `as` keywords** across effect-on-method.ts (10), effect-on-class.ts (2), effect.decorator.ts (3). Refactored code across equivalent new files must not exceed 15 `as` keywords. Using `HookContext extends WrapContext` avoids any new casts. | Count `as` assertions in each new file before completing; use interface extension not structural casting |
| EFFECT_APPLIED_KEY removal | Public export removed; downstream consumers checking EFFECT_APPLIED_KEY by import will break | Acceptable per task (breaking change explicitly stated); no migration guide required per scope |
| effect-on-method-base.spec.ts | Imports `wrapFunction` (eliminated) and `attachHooks` (moved); breaks immediately on rename | Decide whether attachHooks remains exported from effect.decorator.ts for testing or test only via Effect/Wrap |
| WrapOnMethod/WrapOnClass not in index.ts | If accidentally added, exposes internal API contradicting task spec | Add explicit comment in index.ts noting these are intentionally excluded |

---

## index.ts Changes

The updated `src/index.ts` should be:

```typescript
// Remove these two lines:
// export * from './effect-on-method';
// export * from './effect-on-class';

// Add this line:
export * from './wrap.decorator';    // exports Wrap

// Unchanged:
export * from './effect.decorator';  // exports Effect
export type * from './hook.types';   // now also exports WrapContext, WrapFn
export * from './set-meta.decorator';
export * from './on-invoke.hook';
export * from './on-return.hook';
export * from './on-error.hook';
export * from './finally.hook';

// NOT exported (internal):
// wrap-on-method.ts  → WrapOnMethod, WRAP_APPLIED_KEY
// wrap-on-class.ts   → WrapOnClass
```

---

## Recommended Exploration

Before implementation, developer should read:

1. `/workspaces/base-decorators/src/effect-on-method.ts` — Full source to be split; pay attention to `wrapFunction` (lines 121-155) whose logic becomes WrapOnMethod's inner function, `attachHooks` (lines 164-196) which moves unchanged to effect.decorator.ts, and `copySymMeta` (lines 208-229) which moves to wrap-on-method.ts
2. `/workspaces/base-decorators/src/hook.types.ts` — Current HookContext (lines 12-27); all derived types (OnReturnContext, OnErrorContext, hook type aliases) remain valid after the WrapContext split because they all extend HookContext
3. `/workspaces/base-decorators/.claude/rules/preserve-type-safety-during-refactoring.md` — Hard constraint on `as` assertion count; baseline is 15 across the three source files being refactored

---

## Verification Summary

| Check | Status | Notes |
|-------|--------|-------|
| All affected files identified | OK | 3 new src (public: 1, internal: 2), 4 modified src, 2 deleted src; 3 new tests, 3 deleted tests, 1 updated test, 6 verified tests |
| WrapOnMethod/WrapOnClass export status | OK | Correctly marked internal — NOT in index.ts per task spec line 59 |
| Integration points mapped | OK | 15 integration points documented; all hook test files included as VERIFY entries |
| getParameterNames dependency noted | OK | wrap-on-method.ts imports getParameterNames |
| `as` assertion baseline documented | OK | 15 `as` keywords baseline (effect-on-method.ts: 10, effect-on-class.ts: 2, effect.decorator.ts: 3) |
| attachHooks signature preserved | OK | Move unchanged; do NOT drop thisArg parameter |
| Similar patterns found | OK | 3 patterns: Effect dispatcher, EffectOnMethod wrapping, EffectOnClass iteration |
| Test coverage analyzed | OK | All 10 test files assessed with correct action per file |
| Risks assessed | OK | 6 risk areas including type safety NFR as hard constraint |

Limitations/Caveats: The exact internal structure of Effect's WrapFn factory (whether `attachHooks` stays exported for tests or is fully private) is a design decision for the implementer. The task says to "simply move existing logic" which suggests keeping signatures intact.
