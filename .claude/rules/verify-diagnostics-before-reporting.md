---
title: Verify Diagnostics Before Reporting
impact: MEDIUM
---

# Verify Diagnostics Before Reporting

Always run the project's typechecker, linter, or test runner and confirm its exact output before citing a specific diagnostic (error code, line number, or message) in implementation notes or summaries. Unverified diagnostic claims mislead reviewers and create false confidence.

## Incorrect

Citing a diagnostic without running the actual toolchain, or copying a stale line number from memory.

```typescript
// Implementation note claims:
// "There is one minor workspace diagnostic EffectOnMethod.spec.ts line 923 —
//  "'await' has no effect on the type of this expression" (TS80007)."
// In reality, tsc --noEmit produces zero warnings and line 923 is a blank line.
```

## Correct

Run the toolchain, observe the real output, and only report verified findings.

```bash
npm run lint
# No output = no warnings to report.
```

```typescript
// If a real diagnostic exists, reference it only after confirming with the tool:
// "Confirmed via `npm run typecheck`: src/example.ts:42:5 - error TS2345 ..."
```
