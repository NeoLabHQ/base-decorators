---
title: Add wrap decorator
---

> **Required Skill**: You MUST use and analyse `wrap-decorator` skill before doing any modification to task file or starting implementation of it!
>
> Skill location: `.claude/skills/wrap-decorator/SKILL.md`

## Initial User Prompt

add @Wrap decorator and refactor existing Effect decorator to use it. This is breaking change, can be backward incompatible, will remove EffectOnMethod and EffectOnClass decorators and can remove rest utils, to make code structure better. But commonly used decorators like Effect and hooks should support same interface and provide same behavior.

### Requrements

- Refactor existing EffectOnMethod and EffectOnClass decorators to WrapOnMethod and WrapOnClass decorators.
- Refactor existing Effect decorator to Wrap decorator.
- wrap decorator should work with both sync and async methods.
- Write new Effect decorator thath builds on top of Wrap decorator.
- Update @README.md to include new decorator description, also update quick start and how it works sections to use Wrap decorator instead of Effect and include async wrap example in usage section.
- At the end of the task `npm run lint` and `npm run test` should pass!

#### Wrap decorator

Wrap decorator should provide easy way to simplify wrap method to function.
```typescript

export const Log = () => Wrap((method, context: WrapContext) => {
    console.log('method called is', context.propertyKey);
    return (...args: unknown[]) => {
        console.log('method called with', args);
        const result = method(...args);
        console.log('method returned', result);
        return result;
    }
})
```

The `WrapContext` esentially `HookContext` but without args and argsObject. The `HookContext` should be based on `WrapContext` and include additionaly args and argsObject.

#### Effect decorator

Effect decorator should simply use Wrap decorator but on top add hooks logic. Avoid write new logic, simply move existing logic from @src/effect-on-method.ts that handles args and hooks to @src/effect.decorator.ts

# Description

This task introduces a new `Wrap` decorator primitive that provides a direct, flexible way to wrap class methods. Unlike the existing `Effect` decorator, which exposes a fixed set of lifecycle hooks (onInvoke, onReturn, onError, finally), `Wrap` gives the decorator author full control over method execution by accepting a wrapper function of the form `(method, context: WrapContext) => (...args) => result`. This is the foundational building block that all other decorators in the library are built upon.

The architectural change layers the library as: `Wrap` (low-level wrapping) -> `Effect` (hook orchestration built on Wrap) -> convenience hook decorators (OnInvokeHook, OnReturnHook, etc. built on Effect). This separation of concerns makes the library easier to use for simple wrapping scenarios while preserving the full-featured hooks API for complex lifecycle management. Library consumers benefit from a simpler, more natural API for common wrapping patterns, while library maintainers benefit from cleaner separation of concerns in the codebase.

This is a **breaking change**. `EffectOnMethod` and `EffectOnClass` are removed from the public API, replaced internally by `WrapOnMethod` and `WrapOnClass`. Utility functions like `buildArgsObject`, `wrapFunction`, and `attachHooks` may also be internalized. However, the commonly used public API -- `Effect`, `OnInvokeHook`, `OnReturnHook`, `OnErrorHook`, `FinallyHook`, `SetMeta`, `getMeta`, `setMeta` -- maintains the same interface and identical behavior.

A new `WrapContext` type is introduced containing decoration-time and runtime context (target, propertyKey, parameterNames, className, descriptor) without per-call argument data (args, argsObject). `HookContext` is redefined to extend `WrapContext` with the additional `args` and `argsObject` fields, preserving its existing shape.

**Scope**:
- Included:
  - New `Wrap` decorator (usable on both classes and individual methods)
  - New `WrapContext` type (target, propertyKey, parameterNames, className, descriptor)
  - `HookContext` refactored to extend `WrapContext` with args and argsObject
  - Internal `WrapOnMethod` and `WrapOnClass` (not publicly exported)
  - `Effect` refactored to use `Wrap` internally while preserving identical public interface and behavior
  - All hook convenience decorators preserved (OnInvokeHook, OnReturnHook, OnErrorHook, FinallyHook)
  - Metadata API preserved (SetMeta, getMeta, setMeta)
  - Exclusion key mechanism preserved for both Wrap and Effect
  - README updated (Quick Start, How It Works, Wrap documentation, async Wrap example)
  - All tests and lint passing
- Excluded:
  - New hook types or decorator patterns beyond Wrap
  - Migration guide for consumers of removed EffectOnMethod/EffectOnClass exports
  - Performance benchmarks or optimization
  - Changes to SetMeta/getMeta/setMeta public API

**User Scenarios**:
1. **Primary Flow**: A decorator author uses `Wrap((method, context) => (...args) => { ... })` to create a method or class decorator that wraps method calls with custom logic, receiving the original method and a WrapContext, returning a function that is called with the actual arguments.
2. **Alternative Flow**: A decorator author uses `Effect({ onInvoke, onReturn, onError, finally })` exactly as before -- Effect internally delegates to Wrap with hook orchestration logic, producing identical behavior for all lifecycle hooks including factory hooks.
3. **Error Handling**: Errors thrown by the original method or the wrapper function propagate naturally to the caller. For Effect-based decorators, the onError hook continues to intercept errors and can recover or re-throw as before.

---

## Acceptance Criteria

### Functional Requirements

- [X] **Wrap decorator accepts a wrapper function**: Users can create decorators by passing a function of the form `(method, context: WrapContext) => (...args) => result` to Wrap.
  - Given: A wrapper function that logs and delegates to the original method
  - When: The Wrap decorator is applied to a class method and that method is called
  - Then: The wrapper function receives the original method and a WrapContext, and the returned inner function is called with the method arguments, producing the expected result

- [X] **WrapContext contains expected fields without args**: WrapContext includes target, propertyKey, parameterNames, className, and descriptor, but does not include args or argsObject.
  - Given: A Wrap decorator applied to a method
  - When: The wrapped method is called
  - Then: The WrapContext passed to the wrapper function contains target (the class instance), propertyKey (the method name), parameterNames (extracted parameter names), className (from constructor.name), and descriptor (the property descriptor), and does not contain args or argsObject

- [X] **HookContext extends WrapContext with args**: HookContext includes all WrapContext fields plus args (raw arguments array) and argsObject (parameter names mapped to values).
  - Given: An Effect decorator applied to a method with an onInvoke hook
  - When: The wrapped method is called with arguments
  - Then: The HookContext passed to onInvoke contains all WrapContext fields plus args and argsObject with correct values

- [X] **Wrap works as a method decorator**: Wrap can be applied to individual class methods.
  - Given: A class with a single method decorated with Wrap
  - When: The method is called
  - Then: The wrapper function intercepts the call and can observe, modify, or replace the method behavior

- [X] **Wrap works as a class decorator**: Wrap can be applied to a class, wrapping all eligible prototype methods (skipping constructor, getters/setters, and excluded methods).
  - Given: A class decorated with Wrap containing 3 regular methods and 1 getter
  - When: Each regular method is called
  - Then: The wrapper function intercepts each regular method call, and the getter is not wrapped

- [X] **Wrap handles synchronous methods**: Wrap correctly wraps methods that return values synchronously.
  - Given: A synchronous method `add(a, b)` returning `a + b`, decorated with a Wrap that modifies the result
  - When: The method is called with `(2, 3)`
  - Then: The wrapper can call the original method, observe the synchronous return value, and return a modified result

- [X] **Wrap handles asynchronous methods**: Wrap correctly wraps methods that return Promises.
  - Given: An async method `fetchData()` returning a Promise, decorated with Wrap
  - When: The method is called and the returned Promise is awaited
  - Then: The wrapper can call the original method, await the Promise, and return a modified result

- [X] **Effect maintains identical public interface**: Effect accepts the same parameters (HooksOrFactory and optional exclusionKey) as before the refactoring.
  - Given: Existing code using `Effect({ onInvoke, onReturn, onError, finally }, exclusionKey)`
  - When: The code is run against the refactored library
  - Then: The Effect decorator works identically without any code changes required

- [X] **Effect lifecycle hooks fire identically**: All four lifecycle hooks (onInvoke, onReturn, onError, finally) fire at the same points with the same context and produce the same results as the pre-refactor implementation.
  - Given: An Effect decorator with all four hooks defined, applied to a method
  - When: The method is called successfully, and separately when the method throws an error
  - Then: onInvoke fires before execution, onReturn fires after success with the result, onError fires after failure with the error, and finally fires after either outcome -- all with complete HookContext including args and argsObject

- [X] **Hook convenience decorators maintain identical behavior**: OnInvokeHook, OnReturnHook, OnErrorHook, and FinallyHook produce identical behavior to their pre-refactor versions.
  - Given: Existing code using each hook convenience decorator
  - When: The code is run against the refactored library
  - Then: Each hook decorator works identically without any code changes required

- [X] **Exclusion key mechanism works for Wrap**: Class-level Wrap skips methods marked with the exclusion key, and method-level Wrap marks methods to prevent double-wrapping.
  - Given: A class with class-level Wrap and one method also having method-level Wrap with the same exclusion key
  - When: The method-level wrapped method is called
  - Then: Only the method-level wrapper executes (no double-wrapping from the class-level decorator)

- [X] **Metadata preserved across Wrap wrapping**: SetMeta metadata set on original methods survives Wrap wrapping.
  - Given: A method with `@SetMeta(SOME_KEY, someValue)` applied, which is also wrapped by Wrap
  - When: `getMeta(SOME_KEY, descriptor)` is called on the wrapped method's descriptor
  - Then: The original metadata value is returned

- [X] **EffectOnMethod and EffectOnClass removed from public exports**: These identifiers are no longer exported from the library's public entry point.
  - Given: The refactored library's public exports
  - When: Inspecting the available exports
  - Then: Neither `EffectOnMethod` nor `EffectOnClass` is available as a public export

- [X] **README updated with Wrap documentation**: README includes Wrap decorator description, updated Quick Start section, updated How It Works section, and an async Wrap example in the usage section.
  - Given: The updated README file
  - When: A developer reads the documentation
  - Then: They find a Wrap decorator section with usage examples, the Quick Start demonstrates Wrap, How It Works explains Wrap as the foundational primitive, and an async Wrap example is included

- [X] **Build, lint, and tests pass**: `npm run lint` and `npm run test` complete successfully after all changes.
  - Given: The fully refactored codebase with all changes applied
  - When: `npm run lint` and `npm run test` are executed
  - Then: Both commands exit with success (exit code 0) with no failures or errors

### Non-Functional Requirements

- [X] **Type safety**: The refactoring does not increase the number of `as` type assertions compared to the original codebase (13 <= 15 baseline)
- [X] **Zero dependencies**: No new external packages are added to the library
- [X] **Compatibility**: The library continues to work with the existing TypeScript and Node.js configuration

### Definition of Done

- [X] All acceptance criteria pass
- [X] Tests written and passing for Wrap decorator (method-level, class-level, sync, async)
- [X] Existing Effect and hook tests updated and passing
- [X] README documentation updated with Wrap examples
- [X] `npm run lint` passes
- [X] `npm run test` passes
- [ ] Code reviewed

---

## Architecture

### References

- **Skill**: `.claude/skills/wrap-decorator/SKILL.md`
- **Codebase Analysis**: `.specs/analysis/analysis-add-wrap-decorator.md`
- **Scratchpad**: `.specs/scratchpad/5ac65572.md`

### Solution Strategy

**Architecture Pattern**: Layered -- `Wrap` (raw method wrapping) -> `Effect` (hook lifecycle orchestration built on Wrap) -> convenience hooks (thin API wrappers around Effect). This preserves the existing codebase's progressive abstraction pattern while introducing `Wrap` as a lower foundation layer.

**Approach**: Split the current `effect-on-method.ts` into two concerns: (1) a generic method-wrapping primitive (`WrapOnMethod` in `wrap-on-method.ts`) that accepts a `WrapFn` factory and handles descriptor mutation, metadata copying, and exclusion keys; and (2) hook lifecycle orchestration (`buildArgsObject`, `attachHooks`, `resolveHooks`, `chainAsyncHooks`) moved into `effect.decorator.ts`. `Effect` constructs an internal `effectWrapFn` and returns `Wrap(effectWrapFn, exclusionKey)`, delegating ALL class/method dispatch logic to `Wrap`. The `Wrap` dispatcher follows the identical `propertyKey === undefined` pattern from the current `effect.decorator.ts`.

**Key Decisions:**
1. **Effect delegates entirely to Wrap**: `Effect` returns `Wrap(effectWrapFn, exclusionKey)` rather than having its own dispatcher. This eliminates duplicated dispatch logic and 3 `as` type assertions, keeping the total assertion count at 15 (equal to baseline per `preserve-type-safety-during-refactoring.md`).
2. **Preserve attachHooks signature unchanged**: Keep `(originalMethod, thisArg, args, context, hooks)` -- because the task says "simply move existing logic" and the analysis confirms the signature remains unchanged. The pre-bound method + `.apply(thisArg, args)` is functionally equivalent (bind takes precedence over apply for `this`).
3. **WrapFn called per invocation**: The factory `wrapFn(boundMethod, context)` is called inside the runtime wrapper function, giving access to runtime `this` and `className`. This matches Pattern 2 from the skill file.
4. **WRAP_APPLIED_KEY as new default sentinel**: Replaces `EFFECT_APPLIED_KEY`. Internal to `wrap-on-method.ts`, not exported from `index.ts`.
5. **HookContext extends WrapContext via interface extension**: Avoids any new `as` casts. Clean TypeScript interface hierarchy.

**Trade-offs Accepted:**
- Breaking change: Removing `EffectOnMethod`, `EffectOnClass`, `EFFECT_APPLIED_KEY` from public exports -- acceptable per task scope
- Per-invocation factory overhead in WrapOnMethod: Necessary for runtime context (`this`, `className`)
- `attachHooks` receives both pre-bound method and `thisArg`: Minor redundancy, but preserves exact existing behavior with zero risk

### Architecture Decomposition

**Components:**

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `WrapContext` (type in hook.types.ts) | Base context type without args/argsObject | None |
| `WrapFn` (type in hook.types.ts) | Factory signature `(method, context) => (...args) => R` | WrapContext |
| `HookContext` (type in hook.types.ts) | Extends WrapContext with args and argsObject | WrapContext |
| `WrapOnMethod` (src/wrap-on-method.ts) | Core method wrapping: extract param names at decoration time, call WrapFn per invocation, copy sym meta, set exclusion key | getParameterNames, setMeta, SYM_META_PROP, WrapFn, WrapContext |
| `WrapOnClass` (src/wrap-on-class.ts) | Iterate prototype methods, apply WrapOnMethod to eligible ones, skip constructor/getters/excluded | getMeta, WrapFn, WrapOnMethod, WRAP_APPLIED_KEY |
| `Wrap` (src/wrap.decorator.ts) | Public dispatcher: class vs method based on argument count | WrapOnClass, WrapOnMethod, WrapFn |
| `Effect` (src/effect.decorator.ts) | Hook lifecycle layer: constructs effectWrapFn, returns `Wrap(effectWrapFn, exclusionKey)` | Wrap, WrapContext, HookContext, HooksOrFactory |

**Interactions:**

```
User Code
    |
    v
[Wrap] ──dispatch──> [WrapOnClass] ──iterate──> [WrapOnMethod]
    |                                                 |
    +──dispatch─────────────────────────────> [WrapOnMethod]
                                                      |
                                                      v
                                              wrapFn(boundMethod, WrapContext)
                                                      |
                                                      v
                                              (...args) => result

[Effect] ──constructs effectWrapFn──> [Wrap]
                                        |
                                        v
                                  (same dispatch as above)
```

### Runtime Scenarios

**Scenario: Wrap applied to a method**

```
User calls wrappedMethod(arg1, arg2)
    |
    v
WrapOnMethod's inner function(this, ...args)
    |
    +-- boundMethod = originalMethod.bind(this)
    +-- wrapContext = { target: this, propertyKey, parameterNames, className, descriptor }
    +-- innerFn = wrapFn(boundMethod, wrapContext)
    +-- return innerFn(arg1, arg2)
```

**Scenario: Effect applied to a method (delegates to Wrap)**

```
User calls effectDecoratedMethod(arg1, arg2)
    |
    v
WrapOnMethod's inner function(this, ...args)
    |
    +-- boundMethod = originalMethod.bind(this)
    +-- wrapContext = { target: this, propertyKey, parameterNames, className, descriptor }
    +-- innerFn = effectWrapFn(boundMethod, wrapContext)
    |       |
    |       v
    |   returns (...args) => {
    |       argsObject = buildArgsObject(parameterNames, args)
    |       hookContext = { ...wrapContext, args, argsObject }
    |       hooks = resolveHooks(hooksOrFactory, hookContext)
    |       executeMethod = attachHooks(boundMethod, this, args, hookContext, hooks)
    |       if hooks.onInvoke:
    |           result = hooks.onInvoke(hookContext)
    |           if result is Promise: return result.then(executeMethod)
    |       return executeMethod()
    |   }
    +-- return innerFn(arg1, arg2)
```

### Architecture Decisions

#### Effect delegates to Wrap instead of having its own dispatcher

**Status**: Accepted

**Context**: The current `Effect` in `effect.decorator.ts` contains its own class/method dispatch logic. With `Wrap` now providing the same dispatch, `Effect` can delegate.

**Options:**
1. Effect has its own dispatcher (duplicates Wrap's logic, adds 3 `as` casts)
2. Effect returns `Wrap(effectWrapFn, exclusionKey)` (reuses Wrap's dispatch, zero extra casts)

**Decision**: Option 2 -- Effect returns `Wrap(effectWrapFn, exclusionKey)`. This eliminates code duplication and keeps the `as` assertion count at 15 (equal to baseline).

**Consequences:**
- Single source of truth for class/method dispatch (wrap.decorator.ts)
- Effect becomes a pure hook orchestration layer with no dispatch logic
- Total `as` assertion count: wrap-on-method.ts (8) + wrap-on-class.ts (2) + wrap.decorator.ts (3) + effect.decorator.ts (2) = 15

#### Preserve attachHooks signature unchanged

**Status**: Accepted

**Context**: The skill file suggests dropping `thisArg` from `attachHooks` since `Wrap` pre-binds the method. The analysis file says to preserve the signature.

**Options:**
1. Drop `thisArg` -- cleaner API but changes existing logic
2. Keep `thisArg` -- safer migration, move logic as-is

**Decision**: Option 2 -- Keep `thisArg`. The task says "simply move existing logic." Calling `.apply(thisArg, args)` on a pre-bound function is a no-op for `this` binding (bind takes precedence), so behavior is identical.

**Consequences:**
- Zero risk of subtle `this`-binding regressions
- attachHooks tests can be preserved with minimal changes
- Minor redundancy (method is both bound and applied with thisArg)

### Expected Changes

```
src/
+-- wrap-on-method.ts     # NEW: WRAP_APPLIED_KEY, WrapOnMethod, copySymMeta (from effect-on-method.ts)
+-- wrap-on-class.ts      # NEW: WrapOnClass, isPlainMethod, shouldSkipMethod (from effect-on-class.ts)
+-- wrap.decorator.ts     # NEW: Wrap public dispatcher
--- effect-on-method.ts   # DELETE: Split to wrap-on-method.ts + effect.decorator.ts
--- effect-on-class.ts    # DELETE: Moved to wrap-on-class.ts
~~~ effect.decorator.ts   # UPDATE: Gains buildArgsObject, attachHooks, resolveHooks, chainAsyncHooks;
                          #         Effect returns Wrap(effectWrapFn, exclusionKey)
~~~ hook.types.ts         # UPDATE: Add WrapContext, WrapFn; HookContext extends WrapContext
~~~ index.ts              # UPDATE: Remove effect-on-method/effect-on-class; add wrap.decorator

tests/
+-- WrapOnMethod.spec.ts          # NEW
+-- WrapOnClass.spec.ts           # NEW
+-- Wrap.spec.ts                  # NEW
--- EffectOnMethod.spec.ts        # DELETE
--- EffectOnClass.spec.ts         # DELETE
--- effect-on-method-base.spec.ts # DELETE/REWRITE (wrapFunction eliminated; attachHooks moved)
    Effect.spec.ts                # VERIFY (should pass unchanged)
    OnInvokeHook.spec.ts          # VERIFY
    OnReturnHook.spec.ts          # VERIFY
    OnErrorHook.spec.ts           # VERIFY
    FinallyHook.spec.ts           # VERIFY
    SetMeta.spec.ts               # VERIFY
    getParameterNames.spec.ts     # VERIFY

~~~ README.md                     # UPDATE: Wrap docs, Quick Start, How It Works, async example
```

### Workflow Steps

```
Phase 1: Types
+-- 1.1 Update hook.types.ts: Add WrapContext, WrapFn; HookContext extends WrapContext
|
Phase 2: Core Wrap Primitive (depends on Phase 1)
+-- 2.1 Create src/wrap-on-method.ts: WRAP_APPLIED_KEY, WrapOnMethod, copySymMeta
+-- 2.2 Create src/wrap-on-class.ts: WrapOnClass, isPlainMethod, shouldSkipMethod
+-- 2.3 Create src/wrap.decorator.ts: Wrap dispatcher
|
Phase 3: Refactor Effect (depends on Phase 2)
+-- 3.1 Rewrite effect.decorator.ts: Move hook functions from effect-on-method.ts;
|       Effect returns Wrap(effectWrapFn, exclusionKey)
+-- 3.2 Delete src/effect-on-method.ts and src/effect-on-class.ts
|
Phase 4: Update Exports (depends on Phases 2+3)
+-- 4.1 Update src/index.ts
+-- 4.2 Verify: npm run typecheck
|
Phase 5: Tests (depends on Phase 4)
+-- 5.1 Create tests/WrapOnMethod.spec.ts
+-- 5.2 Create tests/WrapOnClass.spec.ts
+-- 5.3 Create tests/Wrap.spec.ts
+-- 5.4 Delete old test files (EffectOnMethod, EffectOnClass, effect-on-method-base)
+-- 5.5 Verify: npm run test && npm run lint
|
Phase 6: Documentation (depends on Phase 5)
+-- 6.1 Update README.md
+-- 6.2 Final: npm run lint && npm run test
```

### Contracts

**WrapContext Interface** (new, in hook.types.ts):
```typescript
interface WrapContext {
  target: object;
  propertyKey: string | symbol;
  parameterNames: string[];
  className: string;
  descriptor: PropertyDescriptor;
}
```

**WrapFn Type** (new, in hook.types.ts):
```typescript
type WrapFn<R = unknown> = (
  method: (...args: unknown[]) => unknown,
  context: WrapContext,
) => (...args: unknown[]) => R;
```

**HookContext Interface** (refactored, in hook.types.ts):
```typescript
interface HookContext extends WrapContext {
  args: unknown[];
  argsObject: HookArgs;
}
```

**Wrap Public API** (new, in wrap.decorator.ts):
```typescript
const Wrap: <R = unknown>(
  wrapFn: WrapFn<R>,
  exclusionKey?: symbol,
) => ClassDecorator & MethodDecorator;
```

**Effect Public API** (unchanged signature, in effect.decorator.ts):
```typescript
const Effect: <R = unknown>(
  hooks: HooksOrFactory<R>,
  exclusionKey?: symbol,
) => ClassDecorator & MethodDecorator;
```

**index.ts Exports** (updated):
```typescript
export * from './wrap.decorator';     // Wrap (public)
export * from './effect.decorator';   // Effect, buildArgsObject (if kept public)
export type * from './hook.types';    // WrapContext, WrapFn, HookContext, etc.
export * from './set-meta.decorator';
export * from './on-invoke.hook';
export * from './on-return.hook';
export * from './on-error.hook';
export * from './finally.hook';
// NOT exported: wrap-on-method.ts, wrap-on-class.ts (internal)
```

---

## Implementation Process

You MUST launch for each step a separate agent, instead of performing all steps yourself. And for each step marked as parallel, you MUST launch separate agents in parallel.

**CRITICAL:** For each agent you MUST:
1. Use the **Agent** type specified in the step (e.g., `haiku`, `sonnet`, `sdd:developer`, `sdd:tech-writer`)
2. Provide path to task file and prompt which step to implement
3. Require agent to implement exactly that step, not more, not less, not other steps

### Implementation Strategy

**Approach**: Bottom-Up (Building-Blocks-First)
**Rationale**: The task extracts and reorganizes existing logic into a new layered architecture: `Wrap` (raw wrapping) -> `Effect` (hook orchestration) -> convenience hooks. The lowest-level building blocks (types, then WrapOnMethod, then WrapOnClass) must exist before higher-level components (Wrap, Effect) can reference them. Bottom-up ensures each foundation layer is solid and type-checked before the next layer builds on it. The core algorithms are already well-defined in the existing codebase, so the primary challenge is correct extraction and wiring -- not algorithmic design.

### Parallelization Overview

```
Step 1 (Update Types) [sdd:developer]
    |
    v
Step 2 (WrapOnMethod) [sdd:developer]
    |
    v
Step 3 (WrapOnClass) [sdd:developer]
    |
    v
Step 4 (Wrap Dispatcher) [sdd:developer]
    |
    v
Step 5 (Refactor Effect + Delete Old Source & Test Files) [sdd:developer]
    |
    |------------------------|----------------------|---------------------|
    v                        v                      v                     v
Step 6                   Step 7                 Step 8                Step 9
(Update Exports)      (WrapOnMethod Tests)   (WrapOnClass Tests)  (Wrap Tests)
[sdd:developer]       [sdd:developer]        [sdd:developer]      [sdd:developer]
(MUST parallel)       (MUST parallel)        (MUST parallel)      (MUST parallel)
    |                        |                      |                     |
    |------------------------|----------------------|---------------------|
    v
Step 10 (Full Test + Lint Suite Verification) [haiku]
    |
    v
Step 11 (README Documentation) [sdd:tech-writer]
```

**Phase Overview:**
- **Phase 1 - Foundation (Steps 1-4):** Sequential chain. Types -> WrapOnMethod -> WrapOnClass -> Wrap Dispatcher. Each step produces artifacts consumed by the next.
- **Phase 2 - Migration (Step 5):** Refactor Effect to use Wrap, delete old source files AND old test files. This eliminates a broken intermediate state.
- **Phase 3 - Exports + Tests (Steps 6-9):** All four steps MUST run in parallel. They touch different files and have no cross-dependencies.
- **Phase 4 - Verification (Step 10):** Synchronization barrier. Run full test + lint suite after all parallel work completes.
- **Phase 5 - Documentation (Step 11):** Update README after all code is verified working.

---

### Step 1: Update Type Definitions in hook.types.ts

**Model:** opus
**Agent:** sdd:developer
**Depends on:** None
**Parallel with:** None

**Goal**: Add `WrapContext` and `WrapFn` types; refactor `HookContext` to extend `WrapContext` so downstream code gets the correct type hierarchy with zero new `as` assertions.

#### Expected Output

- `src/hook.types.ts`: Updated with `WrapContext` interface, `WrapFn` type, and `HookContext extends WrapContext`

#### Success Criteria

- [X] `WrapContext` interface exists in `src/hook.types.ts` with fields: `target`, `propertyKey`, `parameterNames`, `className`, `descriptor`
- [X] `WrapContext` does NOT contain `args` or `argsObject`
- [X] `WrapFn<R>` type exists: `(method: (...args: unknown[]) => unknown, context: WrapContext) => (...args: unknown[]) => R`
- [X] `HookContext` extends `WrapContext` and only adds `args` and `argsObject`
- [X] `HookContext` shape is identical to the pre-refactor version (all 7 fields present)
- [X] All existing type exports (`HookArgs`, `OnReturnContext`, `OnErrorContext`, hook types, `EffectHooks`, `HooksOrFactory`) remain unchanged
- [X] `npm run typecheck` passes (existing code still compiles against updated types)

#### Subtasks

- [X] Add `WrapContext` interface to `src/hook.types.ts` with JSDoc
- [X] Add `WrapFn<R = unknown>` type alias to `src/hook.types.ts` with JSDoc
- [X] Refactor `HookContext` to `interface HookContext extends WrapContext` keeping only `args` and `argsObject`
- [X] Verify exported type list is correct (WrapContext and WrapFn added to exports)
- [X] Run `npm run typecheck` to verify no downstream breakage

#### Verification

**Level:** ✅ CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/hook.types.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Type Correctness | 0.30 | WrapContext has exactly the 5 required fields (target, propertyKey, parameterNames, className, descriptor); WrapFn signature matches spec |
| Interface Hierarchy | 0.25 | HookContext extends WrapContext and only adds args and argsObject; no field duplication |
| Backward Compatibility | 0.25 | All existing type exports (HookArgs, OnReturnContext, OnErrorContext, hook types, EffectHooks, HooksOrFactory) remain unchanged |
| Completeness | 0.10 | Both WrapContext and WrapFn are exported from the types file |
| Code Quality | 0.10 | JSDoc present, follows existing file conventions, no unnecessary `as` assertions |

**Reference Pattern:** `src/hook.types.ts` (pre-refactoring state for existing exports verification)

**Complexity**: Small
**Uncertainty**: Low
**Blockers**: None
**Risks**: None -- additive type change with identical runtime shape

---

### Step 2: Create WrapOnMethod (Core Method Wrapping Primitive)

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 1
**Parallel with:** None

**Goal**: Create `src/wrap-on-method.ts` containing the low-level method decorator that accepts a `WrapFn`, wraps `descriptor.value`, copies symbol metadata, and sets exclusion key. This replaces `EffectOnMethod` as the core wrapping mechanism.

#### Expected Output

- `src/wrap-on-method.ts` (NEW): Contains `WRAP_APPLIED_KEY`, `WrapOnMethod`, `copySymMeta` (private)

#### Success Criteria

- [X] `WRAP_APPLIED_KEY` is a `unique symbol` declared in `src/wrap-on-method.ts`
- [X] `WrapOnMethod<R>(wrapFn: WrapFn<R>, exclusionKey?: symbol): MethodDecorator` function exists
- [X] `WrapOnMethod` extracts parameter names at decoration time via `getParameterNames`
- [X] `WrapOnMethod` creates a wrapped function that: binds original method to `this`, builds `WrapContext` (target, propertyKey, parameterNames, className, descriptor), calls `wrapFn(boundMethod, context)`, returns `innerFn(...args)`
- [X] `copySymMeta` (private) copies `_symMeta` Map from original to wrapped function (moved verbatim from `src/effect-on-method.ts` lines 208-229)
- [X] `WrapOnMethod` calls `copySymMeta` after wrapping
- [X] `WrapOnMethod` calls `setMeta(exclusionKey, true, descriptor)` after wrapping
- [X] `exclusionKey` defaults to `WRAP_APPLIED_KEY` when not provided
- [X] `as` type assertions in this file total 8 or fewer (matching effect-on-method.ts WrapOnMethod-relevant assertions)
- [X] `npm run typecheck` passes

#### Subtasks

- [X] Create `src/wrap-on-method.ts` with imports: `{ setMeta, SYM_META_PROP }` from `./set-meta.decorator`, `{ getParameterNames }` from `./getParameterNames`, `type { WrapFn, WrapContext }` from `./hook.types`
- [X] Declare `WRAP_APPLIED_KEY: unique symbol = Symbol('wrapApplied')` (exported)
- [X] Copy `copySymMeta` function verbatim from `src/effect-on-method.ts` lines 208-229 (private)
- [X] Implement `WrapOnMethod` following the decoration pattern from `src/effect-on-method.ts` lines 48-78 but replacing hook logic with generic `WrapFn` call per Pattern 2 from skill file
- [X] Verify `this` binding: `const boundMethod = originalMethod.bind(this)` inside the wrapped function closure
- [X] Verify `className` extraction: `(this.constructor as { name: string }).name ?? ''`
- [X] Run `npm run typecheck`

#### Verification

**Level:** ✅ CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/wrap-on-method.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Correctness | 0.25 | WrapOnMethod extracts param names at decoration time, calls wrapFn per invocation with bound method and WrapContext, returns innerFn result |
| This Binding | 0.20 | `originalMethod.bind(this)` inside wrapped function closure; className extracted via `this.constructor.name` |
| Metadata Handling | 0.20 | copySymMeta copies _symMeta Map from original to wrapped function; exclusionKey set on descriptor via setMeta |
| Per-Invocation Pattern | 0.15 | WrapFn factory called inside runtime wrapper (not at decoration time); boundMethod created per call |
| Type Safety | 0.10 | `as` type assertions <= 8; proper TypeScript types used |
| Code Quality | 0.10 | Follows existing codebase conventions; proper imports |

**Reference Pattern:** `src/effect-on-method.ts` (pre-refactoring state, lines 48-78 for decoration pattern, lines 208-229 for copySymMeta)

**Complexity**: Medium
**Uncertainty**: Medium -- `this` binding and per-invocation factory pattern require careful implementation
**Blockers**: None
**Risks**:
- `this` binding lost if `originalMethod.bind(this)` omitted -> Test with class instances
- WrapFn called at decoration time instead of per invocation -> Factory must be inside the `wrapped = function(this)` closure
**Integration Points**: Used by WrapOnClass (Step 3) and Wrap dispatcher (Step 4)

---

### Step 3: Create WrapOnClass (Class Iteration Decorator)

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Steps 1, 2
**Parallel with:** None

**Goal**: Create `src/wrap-on-class.ts` containing the class decorator that iterates prototype methods and applies `WrapOnMethod` to eligible ones. This replaces `EffectOnClass`.

#### Expected Output

- `src/wrap-on-class.ts` (NEW): Contains `WrapOnClass`, `isPlainMethod` (private), `shouldSkipMethod` (private)

#### Success Criteria

- [X] `WrapOnClass<R>(wrapFn: WrapFn<R>, exclusionKey?: symbol): ClassDecorator` function exists
- [X] `WrapOnClass` creates a `WrapOnMethod` instance internally with same `wrapFn` and `exclusionKey`
- [X] `WrapOnClass` iterates `Object.getOwnPropertyNames(prototype)`, skipping: `constructor`, non-functions, getters/setters, methods excluded by `exclusionKey`
- [X] `isPlainMethod` (private) moved verbatim from `src/effect-on-class.ts` lines 87-90
- [X] `shouldSkipMethod` (private) moved verbatim from `src/effect-on-class.ts` lines 100-105
- [X] `exclusionKey` defaults to `WRAP_APPLIED_KEY` when not provided
- [X] `as` type assertions in this file total 2 or fewer (matching effect-on-class.ts)
- [X] `npm run typecheck` passes

#### Subtasks

- [X] Create `src/wrap-on-class.ts` with imports: `{ getMeta }` from `./set-meta.decorator`, `type { WrapFn }` from `./hook.types`, `{ WrapOnMethod, WRAP_APPLIED_KEY }` from `./wrap-on-method`
- [X] Copy `isPlainMethod` function verbatim from `src/effect-on-class.ts` lines 87-90 (private)
- [X] Copy `shouldSkipMethod` function verbatim from `src/effect-on-class.ts` lines 100-105 (private)
- [X] Implement `WrapOnClass` following the pattern from `src/effect-on-class.ts` lines 50-78 but using `WrapOnMethod` and `WRAP_APPLIED_KEY` instead of `EffectOnMethod` and `EFFECT_APPLIED_KEY`
- [X] Run `npm run typecheck`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `src/wrap-on-class.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Correctness | 0.30 | Iterates Object.getOwnPropertyNames(prototype), creates WrapOnMethod internally, applies to eligible methods |
| Skip Logic | 0.25 | Correctly skips constructor, non-functions, getters/setters (isPlainMethod), excluded methods (shouldSkipMethod) |
| Code Fidelity | 0.20 | isPlainMethod and shouldSkipMethod moved verbatim from effect-on-class.ts |
| Type Safety | 0.15 | `as` type assertions <= 2; proper TypeScript types |
| Code Quality | 0.10 | Follows existing conventions; proper imports from wrap-on-method |

**Reference Pattern:** `src/effect-on-class.ts` (pre-refactoring state, lines 50-78 for WrapOnClass pattern, lines 87-105 for helper functions)

**Complexity**: Small
**Uncertainty**: Low -- direct adaptation of existing effect-on-class.ts
**Blockers**: None
**Risks**: None -- straightforward code move with import path changes
**Integration Points**: Used by Wrap dispatcher (Step 4)

---

### Step 4: Create Wrap Public Dispatcher

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Steps 2, 3
**Parallel with:** None

**Goal**: Create `src/wrap.decorator.ts` containing the public `Wrap` decorator that dispatches to `WrapOnClass` or `WrapOnMethod` based on argument count, exactly like the current `Effect` dispatcher.

#### Expected Output

- `src/wrap.decorator.ts` (NEW): Contains `Wrap` function

#### Success Criteria

- [X] `Wrap<R>(wrapFn: WrapFn<R>, exclusionKey?: symbol): ClassDecorator & MethodDecorator` function exists and is exported
- [X] When applied to a class (1 argument, `propertyKey === undefined`), delegates to `WrapOnClass`
- [X] When applied to a method (3 arguments, `descriptor !== undefined`), delegates to `WrapOnMethod`
- [X] Throws `Error` with descriptive message for invalid context
- [X] `as` type assertions in this file total 3 or fewer (matching effect.decorator.ts dispatcher)
- [X] `npm run typecheck` passes

#### Subtasks

- [X] Create `src/wrap.decorator.ts` with imports: `{ WrapOnClass }` from `./wrap-on-class`, `{ WrapOnMethod }` from `./wrap-on-method`, `type { WrapFn }` from `./hook.types`
- [X] Implement `Wrap` following the dispatcher pattern from `src/effect.decorator.ts` lines 48-73, replacing `EffectOnClass`/`EffectOnMethod` with `WrapOnClass`/`WrapOnMethod` and replacing `HooksOrFactory` param with `WrapFn`
- [X] Verify error message for invalid context: `'Wrap decorator can only be applied to classes or methods'`
- [X] Run `npm run typecheck`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `src/wrap.decorator.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Dispatch Correctness | 0.35 | Class decoration (1 arg, propertyKey undefined) delegates to WrapOnClass; method decoration (3 args) delegates to WrapOnMethod |
| API Shape | 0.25 | Exported function signature matches: `Wrap<R>(wrapFn: WrapFn<R>, exclusionKey?: symbol): ClassDecorator & MethodDecorator` |
| Error Handling | 0.20 | Throws descriptive Error for invalid decorator context |
| Type Safety | 0.10 | `as` type assertions <= 3 |
| Code Quality | 0.10 | Follows pattern from existing effect.decorator.ts dispatcher |

**Reference Pattern:** `src/effect.decorator.ts` (pre-refactoring state, lines 48-73 for dispatcher pattern)

**Complexity**: Small
**Uncertainty**: Low -- direct adaptation of existing effect.decorator.ts dispatcher
**Blockers**: None
**Risks**: None
**Integration Points**: Used by Effect (Step 5), exported publicly via index.ts (Step 6)

---

### Step 5: Refactor Effect to Use Wrap, Delete Old Source and Test Files

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 4
**Parallel with:** None

**Goal**: Rewrite `effect.decorator.ts` so that `Effect` constructs an internal `effectWrapFn` and returns `Wrap(effectWrapFn, exclusionKey)`, delegating all class/method dispatch logic to Wrap. Move `buildArgsObject`, `attachHooks`, `resolveHooks`, and `chainAsyncHooks` from `effect-on-method.ts` into `effect.decorator.ts`. Delete the now-unused `src/effect-on-method.ts`, `src/effect-on-class.ts`, AND obsolete test files (`tests/EffectOnMethod.spec.ts`, `tests/EffectOnClass.spec.ts`, `tests/effect-on-method-base.spec.ts`).

**Note**: Old test files MUST be deleted in this step (not later) because they import from deleted source files and would cause typecheck/test failures in subsequent parallel steps.

#### Expected Output

- `src/effect.decorator.ts` (UPDATED): Contains `Effect`, `buildArgsObject`, `attachHooks` (private), `resolveHooks` (private), `chainAsyncHooks` (private), `effectWrapFn` construction
- `src/effect-on-method.ts` (DELETED)
- `src/effect-on-class.ts` (DELETED)
- `tests/EffectOnMethod.spec.ts` (DELETED)
- `tests/EffectOnClass.spec.ts` (DELETED)
- `tests/effect-on-method-base.spec.ts` (DELETED)

#### Success Criteria

- [X] `Effect` function signature unchanged: `<R>(hooks: HooksOrFactory<R>, exclusionKey?: symbol): ClassDecorator & MethodDecorator`
- [X] `Effect` internally constructs an `effectWrapFn` of type `WrapFn` and returns `Wrap(effectWrapFn, exclusionKey)`
- [X] `effectWrapFn` receives `(boundMethod, wrapContext)` and returns `(...args) => unknown` that: calls `buildArgsObject`, builds `HookContext` from `WrapContext + args + argsObject`, calls `resolveHooks`, calls `attachHooks`, checks `onInvoke` (sync/async), returns result
- [X] `buildArgsObject` moved verbatim from `src/effect-on-method.ts` lines 98-115
- [X] `attachHooks` moved verbatim from `src/effect-on-method.ts` lines 164-196 with unchanged signature `(originalMethod, thisArg, args, context, hooks)`
- [X] `resolveHooks` moved verbatim from `src/effect-on-method.ts` lines 237-245 (private)
- [X] `chainAsyncHooks` moved verbatim from `src/effect-on-method.ts` lines 253-275 (private)
- [X] `Effect` no longer imports from `./effect-on-method` or `./effect-on-class`
- [X] `Effect` imports `{ Wrap }` from `./wrap.decorator`
- [X] `src/effect-on-method.ts` deleted
- [X] `src/effect-on-class.ts` deleted
- [X] `tests/EffectOnMethod.spec.ts` deleted
- [X] `tests/EffectOnClass.spec.ts` deleted
- [X] `tests/effect-on-method-base.spec.ts` deleted
- [X] Total `as` type assertions across `wrap-on-method.ts`, `wrap-on-class.ts`, `wrap.decorator.ts`, `effect.decorator.ts` is <= 15 (baseline count)
- [X] `npm run typecheck` passes

#### Subtasks

- [X] Move `buildArgsObject` function from `src/effect-on-method.ts` to `src/effect.decorator.ts`
- [X] Move `attachHooks` function from `src/effect-on-method.ts` to `src/effect.decorator.ts` (keep same signature with `thisArg`)
- [X] Move `resolveHooks` function from `src/effect-on-method.ts` to `src/effect.decorator.ts` (private)
- [X] Move `chainAsyncHooks` function from `src/effect-on-method.ts` to `src/effect.decorator.ts` (private)
- [X] Construct `effectWrapFn` inside `Effect` following Pattern 3 from skill file (`.claude/skills/wrap-decorator/SKILL.md` lines 99-112)
- [X] Replace current `Effect` body with: `return Wrap(effectWrapFn, exclusionKey)` -- removing its own class/method dispatcher logic
- [X] Update imports in `src/effect.decorator.ts`: add `{ Wrap }` from `./wrap.decorator`; add `type { WrapContext }` from `./hook.types`; remove `{ EffectOnMethod }` and `{ EffectOnClass }`
- [X] Delete `src/effect-on-method.ts`
- [X] Delete `src/effect-on-class.ts`
- [X] Delete `tests/EffectOnMethod.spec.ts`
- [X] Delete `tests/EffectOnClass.spec.ts`
- [X] Delete `tests/effect-on-method-base.spec.ts`
- [X] Count `as` type assertions across all 4 refactored source files; verify total <= 15
- [X] Run `npm run typecheck`

#### Verification

**Level:** ✅ CRITICAL - Panel of 2 Judges with Aggregated Voting
**Artifact:** `src/effect.decorator.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Behavioral Equivalence | 0.30 | Effect produces identical behavior for all hooks (onInvoke, onReturn, onError, finally) in both sync and async scenarios |
| Function Migration | 0.25 | buildArgsObject, attachHooks, resolveHooks, chainAsyncHooks moved verbatim from effect-on-method.ts with unchanged signatures |
| Delegation Pattern | 0.20 | Effect constructs effectWrapFn and returns Wrap(effectWrapFn, exclusionKey); no own dispatcher logic |
| File Cleanup | 0.10 | effect-on-method.ts, effect-on-class.ts deleted; 3 obsolete test files deleted |
| Type Safety | 0.15 | Total `as` assertions across wrap-on-method.ts + wrap-on-class.ts + wrap.decorator.ts + effect.decorator.ts <= 15 |

**Reference Pattern:** `src/effect-on-method.ts` (pre-refactoring state, lines 98-115 for buildArgsObject, lines 164-196 for attachHooks, lines 237-275 for resolveHooks/chainAsyncHooks)

**Complexity**: Large
**Uncertainty**: Medium -- must faithfully move 4 functions and construct effectWrapFn bridge while maintaining exact behavioral equivalence
**Blockers**: None
**Risks**:
- Hook behavior regression if functions not moved verbatim -> Copy exact function bodies, only change import paths
- `as` assertion count exceeds 15 -> Use `HookContext extends WrapContext` (no new casts needed)
- `attachHooks` `this` binding subtle issue -> Keep `thisArg` parameter unchanged; `.apply(thisArg, args)` on pre-bound method is a no-op for `this` (bind takes precedence)
**Integration Points**: Effect is consumed by all convenience hook decorators (on-invoke.hook.ts, on-return.hook.ts, on-error.hook.ts, finally.hook.ts)

---

### Step 6: Update Exports in index.ts

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5
**Parallel with:** Steps 7, 8, 9 -- all four MUST be launched in parallel

**Goal**: Update `src/index.ts` to remove old module exports and add the new `wrap.decorator` export, ensuring the public API reflects the refactored architecture.

#### Expected Output

- `src/index.ts` (UPDATED): Exports `wrap.decorator`; no longer exports `effect-on-method` or `effect-on-class`

#### Success Criteria

- [X] `export * from './effect-on-method'` line removed from `src/index.ts`
- [X] `export * from './effect-on-class'` line removed from `src/index.ts`
- [X] `export * from './wrap.decorator'` line added to `src/index.ts` (exports `Wrap`)
- [X] `export * from './effect.decorator'` unchanged (exports `Effect`, `buildArgsObject`)
- [X] `export type * from './hook.types'` unchanged (now also exports `WrapContext`, `WrapFn`)
- [X] All other export lines unchanged (set-meta.decorator, hook files)
- [X] Comment noting `wrap-on-method.ts` and `wrap-on-class.ts` are intentionally not exported
- [X] `npm run typecheck` passes
- [X] `npm run build` passes

#### Subtasks

- [X] Remove `export * from './effect-on-method'` from `src/index.ts`
- [X] Remove `export * from './effect-on-class'` from `src/index.ts`
- [X] Add `export * from './wrap.decorator'` to `src/index.ts`
- [X] Add comment: `// Internal (not exported): wrap-on-method.ts, wrap-on-class.ts`
- [X] Run `npm run typecheck`
- [X] Run `npm run build`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `src/index.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Export Correctness | 0.35 | wrap.decorator exported; effect-on-method and effect-on-class removed; effect.decorator and hook.types unchanged |
| Completeness | 0.25 | All required exports present (wrap.decorator, effect.decorator, hook.types, set-meta, all hooks) |
| Internal Modules | 0.20 | wrap-on-method.ts and wrap-on-class.ts NOT exported; comment noting intentional non-export |
| Build Verification | 0.20 | Both typecheck and build pass |

**Complexity**: Small
**Uncertainty**: Low
**Blockers**: None
**Risks**: None
**Integration Points**: This is the public API surface; all consumers import via index.ts

---

### Step 7: Write WrapOnMethod Tests

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5
**Parallel with:** Steps 6, 8, 9 -- all four MUST be launched in parallel

**Goal**: Create comprehensive unit tests for `WrapOnMethod` covering sync/async wrapping, `this` binding, WrapContext fields, copySymMeta, exclusion key, and WRAP_APPLIED_KEY sentinel.

#### Expected Output

- `tests/WrapOnMethod.spec.ts` (NEW)

#### Success Criteria

- [X] Test file `tests/WrapOnMethod.spec.ts` exists
- [X] Tests cover: WrapFn called per invocation with bound method and WrapContext
- [X] Tests cover: WrapContext contains correct fields (target, propertyKey, parameterNames, className, descriptor)
- [X] Tests cover: WrapContext does NOT contain args or argsObject
- [X] Tests cover: sync method wrapping (return value passthrough and modification)
- [X] Tests cover: async method wrapping (Promise handling)
- [X] Tests cover: `this` binding preserved (bound method has correct `this`)
- [X] Tests cover: `WRAP_APPLIED_KEY` set on descriptor after wrapping
- [X] Tests cover: custom `exclusionKey` set on descriptor when provided
- [X] Tests cover: `copySymMeta` copies existing `_symMeta` from original to wrapped function
- [X] Tests cover: parameter names extracted correctly
- [X] All new tests pass: `npm run test`

#### Subtasks

- [X] Create `tests/WrapOnMethod.spec.ts` importing `WrapOnMethod` and `WRAP_APPLIED_KEY` from `../src/wrap-on-method`
- [X] Write test: WrapFn receives bound method and WrapContext on each invocation
- [X] Write test: WrapContext fields are correct (target is class instance, propertyKey is method name, etc.)
- [X] Write test: sync method wrapping works (wrapper can observe and modify result)
- [X] Write test: async method wrapping works (wrapper can await and modify result)
- [X] Write test: `this` binding is correct inside wrapper's bound method
- [X] Write test: WRAP_APPLIED_KEY metadata set on descriptor
- [X] Write test: custom exclusionKey metadata set on descriptor
- [X] Write test: symbol metadata copied from original to wrapped function
- [X] Write test: parameter names extracted from function signature
- [X] Run `npm run test`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `tests/WrapOnMethod.spec.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Coverage | 0.30 | Tests cover all 11 success criteria: WrapFn per invocation, WrapContext fields, no args/argsObject, sync, async, this binding, WRAP_APPLIED_KEY, custom exclusionKey, copySymMeta, param names |
| Edge Cases | 0.25 | Async promise handling, metadata preservation, exclusion key behavior |
| Correctness | 0.20 | Tests actually assert the right things (not just running without error) |
| Isolation | 0.15 | Tests independent; no shared mutable state between tests |
| Clarity | 0.10 | Test names clearly describe what they verify |

**Reference Pattern:** `tests/Effect.spec.ts` (existing test structure and conventions)

**Complexity**: Medium
**Uncertainty**: Low
**Blockers**: None
**Risks**: None
**Integration Points**: Tests import directly from `../src/wrap-on-method` (internal module)

---

### Step 8: Write WrapOnClass Tests

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5
**Parallel with:** Steps 6, 7, 9 -- all four MUST be launched in parallel

**Goal**: Create unit tests for `WrapOnClass` covering prototype iteration, skip logic, and exclusion key behavior.

#### Expected Output

- `tests/WrapOnClass.spec.ts` (NEW)

#### Success Criteria

- [X] Test file `tests/WrapOnClass.spec.ts` exists
- [X] Tests cover: wraps all regular prototype methods
- [X] Tests cover: skips `constructor`
- [X] Tests cover: skips getters and setters
- [X] Tests cover: skips non-function prototype values
- [X] Tests cover: skips methods marked with exclusion key via `SetMeta`
- [X] Tests cover: skips methods already wrapped at method level (same exclusion key)
- [X] Tests cover: WRAP_APPLIED_KEY used as default exclusion key
- [X] Tests cover: custom exclusion key propagated to WrapOnMethod
- [X] All new tests pass: `npm run test`

#### Subtasks

- [X] Create `tests/WrapOnClass.spec.ts` importing `WrapOnClass` from `../src/wrap-on-class` and related utilities
- [X] Write test: all prototype methods wrapped (3 methods, WrapFn called for each)
- [X] Write test: constructor not wrapped
- [X] Write test: getters/setters not wrapped
- [X] Write test: methods with exclusion key metadata skipped
- [X] Write test: method-level Wrap prevents class-level double-wrapping
- [X] Write test: custom exclusion key works correctly
- [X] Run `npm run test`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `tests/WrapOnClass.spec.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Coverage | 0.30 | Tests cover all 9 success criteria: wraps all methods, skips constructor, skips getters/setters, skips non-functions, skips exclusion key methods, skips already-wrapped, default key, custom key |
| Edge Cases | 0.25 | Getter/setter skip logic, double-wrapping prevention, custom vs default exclusion key |
| Correctness | 0.20 | Tests assert correct wrapping behavior (not just no errors) |
| Isolation | 0.15 | Tests independent; separate class fixtures per test |
| Clarity | 0.10 | Test names clearly describe what they verify |

**Reference Pattern:** `tests/Effect.spec.ts` (existing test structure and conventions)

**Complexity**: Medium
**Uncertainty**: Low
**Blockers**: None
**Risks**: None

---

### Step 9: Write Wrap Dispatcher Tests

**Model:** opus
**Agent:** sdd:developer
**Depends on:** Step 5
**Parallel with:** Steps 6, 7, 8 -- all four MUST be launched in parallel

**Goal**: Create unit tests for the public `Wrap` decorator covering class and method dispatch, user-provided WrapFn shape, and sync/async interop.

#### Expected Output

- `tests/Wrap.spec.ts` (NEW)

#### Success Criteria

- [X] Test file `tests/Wrap.spec.ts` exists
- [X] Tests cover: Wrap applied to a method (decorates single method)
- [X] Tests cover: Wrap applied to a class (decorates all eligible prototype methods)
- [X] Tests cover: user-provided WrapFn receives bound method and WrapContext
- [X] Tests cover: sync method through Wrap works correctly
- [X] Tests cover: async method through Wrap works correctly
- [X] Tests cover: Wrap with exclusion key prevents double-wrapping at class level
- [X] Tests cover: error thrown for invalid decorator context
- [X] All new tests pass: `npm run test`

#### Subtasks

- [X] Create `tests/Wrap.spec.ts` importing `Wrap` from `../src/wrap.decorator` (or via index)
- [X] Write test: method-level Wrap decorates and wraps correctly
- [X] Write test: class-level Wrap decorates all prototype methods
- [X] Write test: WrapFn shape verified (receives bound method + WrapContext)
- [X] Write test: sync method wrapped correctly
- [X] Write test: async method wrapped correctly
- [X] Write test: exclusion key prevents double-wrapping
- [X] Write test: invalid context throws Error
- [X] Run `npm run test`

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `tests/Wrap.spec.ts`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Coverage | 0.30 | Tests cover all 8 success criteria: method-level, class-level, WrapFn shape, sync, async, exclusion key, error on invalid context |
| Edge Cases | 0.25 | Invalid decorator context error, exclusion key double-wrapping prevention |
| Correctness | 0.20 | Tests assert dispatch behavior and wrapper execution |
| Isolation | 0.15 | Tests independent |
| Clarity | 0.10 | Test names clearly describe what they verify |

**Reference Pattern:** `tests/Effect.spec.ts` (existing test structure and conventions)

**Complexity**: Medium
**Uncertainty**: Low
**Blockers**: None
**Risks**: None

---

### Step 10: Run Full Test + Lint Suite (Verification)

**Model:** haiku
**Agent:** haiku
**Depends on:** Steps 6, 7, 8, 9
**Parallel with:** None

**Goal**: Verify that the entire test suite passes and linting is clean after all parallel work from Steps 6-9 has completed.

#### Expected Output

- Full test suite passes (all new Wrap tests + all existing Effect/hook/meta tests)
- Lint passes

#### Success Criteria

- [X] `tests/Effect.spec.ts` passes unchanged (Effect interface preserved)
- [X] `tests/OnInvokeHook.spec.ts` passes unchanged
- [X] `tests/OnReturnHook.spec.ts` passes unchanged
- [X] `tests/OnErrorHook.spec.ts` passes unchanged
- [X] `tests/FinallyHook.spec.ts` passes unchanged
- [X] `tests/SetMeta.spec.ts` passes unchanged
- [X] `tests/getParameterNames.spec.ts` passes unchanged
- [X] `tests/WrapOnMethod.spec.ts` passes (new)
- [X] `tests/WrapOnClass.spec.ts` passes (new)
- [X] `tests/Wrap.spec.ts` passes (new)
- [X] `npm run test` exits with code 0, all tests passing
- [X] `npm run lint` exits with code 0

#### Subtasks

- [X] Run `npm run test` and verify all tests pass
- [X] Run `npm run lint` and verify no errors
- [X] If any failures, report the exact error output for debugging

**Complexity**: Small
**Uncertainty**: Low
**Blockers**: None
#### Verification

**Level:** ❌ NOT NEEDED
**Rationale:** Binary pass/fail verification. Running `npm run test` and `npm run lint` produces exit codes. No judgment or rubric needed -- either all tests pass and lint is clean, or they do not.

**Risks**:
- Existing Effect tests may fail if Effect refactoring has subtle behavioral differences -> If failures occur, debug by comparing old and new Effect execution paths
**Integration Points**: This step validates the entire refactoring is behaviorally equivalent

---

### Step 11: Update README Documentation

**Model:** opus
**Agent:** sdd:tech-writer
**Depends on:** Step 10
**Parallel with:** None

**Goal**: Update `README.md` to document the `Wrap` decorator as the foundational primitive, update Quick Start and How It Works sections to showcase Wrap, and add an async Wrap usage example.

#### Expected Output

- `README.md` (UPDATED): New Wrap section, updated Quick Start, updated How It Works, async Wrap example, updated API reference table

#### Success Criteria

- [X] Quick Start section updated to demonstrate `Wrap` decorator usage
- [X] How It Works section updated to explain `Wrap` as the foundational primitive and `Effect` as a higher-level abstraction built on Wrap
- [X] New "Wrap" section added to Usage with a basic synchronous example
- [X] New "Async Wrap" example added to Usage section
- [X] API Reference table updated: `Wrap` added as a new export with description
- [X] API Reference table updated: `WrapContext` and `WrapFn` types mentioned
- [X] `EffectOnMethod` and `EffectOnClass` no longer referenced in API reference or exports
- [X] All existing sections that still apply (Effect, hooks, metadata, exclusion keys) remain accurate
- [X] `npm run lint` passes
- [X] `npm run test` passes

#### Subtasks

- [X] Update Quick Start section in `README.md` to use Wrap decorator example
- [X] Update How It Works section to explain Wrap -> Effect -> hooks layering
- [X] Add Wrap decorator basic usage section (sync example from skill file)
- [X] Add async Wrap usage example (async timer pattern from skill file)
- [X] Update API Reference table: add Wrap, WrapContext, WrapFn; remove EffectOnMethod, EffectOnClass references
- [X] Review all existing sections for accuracy with refactored code
- [X] Run `npm run lint && npm run test` as final verification

#### Verification

**Level:** ✅ Single Judge
**Artifact:** `README.md`
**Threshold:** 4.0/5.0

**Rubric:**

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Content Accuracy | 0.25 | Wrap examples compile and match actual API; Effect documentation still accurate |
| Completeness | 0.25 | Quick Start updated, How It Works updated, Wrap section added, async Wrap example added, API reference updated |
| Removed References | 0.20 | EffectOnMethod and EffectOnClass no longer referenced in API reference |
| Consistency | 0.15 | Terminology consistent; Wrap described as foundational primitive, Effect as higher-level abstraction |
| Examples Quality | 0.15 | Examples are clear, runnable, and demonstrate key patterns |

**Reference Pattern:** `README.md` (pre-update state for structural reference)

**Complexity**: Medium
**Uncertainty**: Low
**Blockers**: None
**Risks**: None

---

## Implementation Summary

| Step | Phase | Goal | Agent | Key Output | Est. Effort | Dependencies | Parallel With |
|------|-------|------|-------|------------|-------------|--------------|---------------|
| 1 | Foundation | Type definitions | sdd:developer | `src/hook.types.ts` updated | S | None | None |
| 2 | Foundation | WrapOnMethod primitive | sdd:developer | `src/wrap-on-method.ts` (NEW) | M | Step 1 | None |
| 3 | Foundation | WrapOnClass primitive | sdd:developer | `src/wrap-on-class.ts` (NEW) | S | Steps 1, 2 | None |
| 4 | Foundation | Wrap dispatcher | sdd:developer | `src/wrap.decorator.ts` (NEW) | S | Steps 2, 3 | None |
| 5 | Migration | Effect refactored + old files deleted | sdd:developer | `src/effect.decorator.ts` updated, 5 files deleted | L | Step 4 | None |
| 6 | Exports + Tests | Export updates | sdd:developer | `src/index.ts` updated | S | Step 5 | Steps 7, 8, 9 |
| 7 | Exports + Tests | WrapOnMethod tests | sdd:developer | `tests/WrapOnMethod.spec.ts` (NEW) | M | Step 5 | Steps 6, 8, 9 |
| 8 | Exports + Tests | WrapOnClass tests | sdd:developer | `tests/WrapOnClass.spec.ts` (NEW) | M | Step 5 | Steps 6, 7, 9 |
| 9 | Exports + Tests | Wrap dispatcher tests | sdd:developer | `tests/Wrap.spec.ts` (NEW) | M | Step 5 | Steps 6, 7, 8 |
| 10 | Verification | Full test + lint suite | haiku | All tests green, lint clean | S | Steps 6, 7, 8, 9 | None |
| 11 | Documentation | README update | sdd:tech-writer | `README.md` updated | M | Step 10 | None |

**Total Steps**: 11
**Critical Path**: Steps 1 -> 2 -> 3 -> 4 -> 5 -> {6,7,8,9} -> 10 -> 11
**Max Parallelization Depth**: 4 steps simultaneously (Steps 6, 7, 8, 9)
**Merged Steps**: Old test file deletion (originally Step 10) merged into Step 5 to avoid broken intermediate state

---

## Verification Summary

| Step | Verification Level | Judges | Threshold | Artifacts |
|------|-------------------|--------|-----------|-----------|
| 1 | ✅ Panel (2) | 2 | 4.0/5.0 | `src/hook.types.ts` - WrapContext, WrapFn, HookContext extends WrapContext |
| 2 | ✅ Panel (2) | 2 | 4.0/5.0 | `src/wrap-on-method.ts` - Core method wrapping primitive |
| 3 | ✅ Single | 1 | 4.0/5.0 | `src/wrap-on-class.ts` - Class iteration decorator |
| 4 | ✅ Single | 1 | 4.0/5.0 | `src/wrap.decorator.ts` - Public Wrap dispatcher |
| 5 | ✅ Panel (2) | 2 | 4.0/5.0 | `src/effect.decorator.ts` - Effect refactored + old files deleted |
| 6 | ✅ Single | 1 | 4.0/5.0 | `src/index.ts` - Export updates |
| 7 | ✅ Single | 1 | 4.0/5.0 | `tests/WrapOnMethod.spec.ts` - WrapOnMethod test suite |
| 8 | ✅ Single | 1 | 4.0/5.0 | `tests/WrapOnClass.spec.ts` - WrapOnClass test suite |
| 9 | ✅ Single | 1 | 4.0/5.0 | `tests/Wrap.spec.ts` - Wrap dispatcher test suite |
| 10 | ❌ None | - | - | Full test + lint suite verification (binary pass/fail) |
| 11 | ✅ Single | 1 | 4.0/5.0 | `README.md` - Wrap documentation |

**Total Evaluations:** 13
**Implementation Command:** `/implement .specs/tasks/draft/add-wrap-decorator.feature.md`

---

## Risks & Blockers Summary

### High Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| `this` binding lost in WrapOnMethod | High | Medium | Explicitly bind: `const boundMethod = originalMethod.bind(this)` inside wrapped function; test with class instances in Step 7 |
| Effect behavioral regression after refactoring | High | Low | Copy hook functions (buildArgsObject, attachHooks, resolveHooks, chainAsyncHooks) verbatim; verify via unchanged Effect.spec.ts in Step 10 |
| `as` type assertion count exceeds baseline (15) | Medium | Low | Use `HookContext extends WrapContext` (zero new casts); count assertions after Step 5; budget: wrap-on-method.ts(8) + wrap-on-class.ts(2) + wrap.decorator.ts(3) + effect.decorator.ts(2) = 15 |

### Medium Priority

| Risk/Blocker | Impact | Likelihood | Mitigation |
|--------------|--------|------------|------------|
| WrapFn called at decoration time instead of per invocation | High | Low | Factory call must be inside `wrapped = function(this)` closure, not at decoration time |
| `attachHooks` receives pre-bound method + `thisArg` redundancy | Low | Certain | Acceptable: `.apply(thisArg, args)` on pre-bound function is a no-op for `this` (bind takes precedence); preserves exact existing logic |
| Existing Effect.spec.ts tests fail after refactoring | Medium | Low | Debug by comparing old/new execution paths; Effect interface is preserved |

---

## High Complexity/Uncertainty Tasks Requiring Attention

**Step 5: Refactor Effect to Use Wrap and Delete Old Files**
- Complexity: Large (moves 4 functions, constructs effectWrapFn bridge, deletes 2 source files)
- Uncertainty: Medium (must maintain exact behavioral equivalence for all hook lifecycle scenarios)
- Recommendation: Follow Pattern 3 from skill file verbatim; copy functions without modification; count `as` assertions before proceeding

**Step 2: Create WrapOnMethod**
- Complexity: Medium
- Uncertainty: Medium (`this` binding and per-invocation factory require careful implementation)
- Recommendation: Follow Pattern 2 from skill file; test thoroughly in Step 7

---

## Definition of Done (Task Level)

- [X] All 11 implementation steps completed (Steps 6-9 executed in parallel)
- [X] All acceptance criteria from the task specification verified
- [X] New tests written and passing: WrapOnMethod.spec.ts, WrapOnClass.spec.ts, Wrap.spec.ts
- [X] Existing tests passing: Effect.spec.ts, OnInvokeHook.spec.ts, OnReturnHook.spec.ts, OnErrorHook.spec.ts, FinallyHook.spec.ts, SetMeta.spec.ts, getParameterNames.spec.ts
- [X] Old test files deleted: EffectOnMethod.spec.ts, EffectOnClass.spec.ts, effect-on-method-base.spec.ts
- [X] `as` type assertion count across refactored files <= 15 (baseline) -- actual: 13
- [X] README documentation updated with Wrap examples
- [X] `npm run lint` passes (exit code 0)
- [X] `npm run test` passes (exit code 0)
- [X] `npm run build` passes (exit code 0)
- [X] No new external dependencies added
- [ ] Code reviewed
