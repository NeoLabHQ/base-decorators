# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use @README.md for project overview, @CONTRIBUTING.md for contributing guidelines, @package.json for avaiable commands.

## Commit Conventions

This project uses **semantic-release** with **Conventional Commits**. Follow the `type(scope): subject` format (feat, fix, docs, style, refactor, perf, test, chore, ci) for commits.

## Architecture

**Purpose:** A zero-dependency TypeScript decorator primitives library that simplify creation of decorators.

**Core flow:**

1. `Effect` / `EffectOnMethod` / `EffectOnClass` (src/) — Logger-agnostic decorator primitives. `EffectOnMethod` wraps a single method: extracts parameter names, builds a `HookContext` (args object, target, propertyKey, descriptor, parameterNames, className), and invokes lifecycle hooks. `EffectOnClass` iterates prototype methods and applies `EffectOnMethod` to each. `Effect` dispatches to one or the other based on argument count.
3. `buildArgsObject` (src/effect-on-method.ts) — Maps parameter names to their call-time values to produce the pre-built `args` object passed in every `HookContext`.
