# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use @README.md for project overview, @CONTRIBUTING.md for contributing guidelines, @package.json for avaiable commands.

## Commit Conventions

This project uses **semantic-release** with **Conventional Commits**. Follow the `type(scope): subject` format (feat, fix, docs, style, refactor, perf, test, chore, ci) for commits.

## Architecture

**Purpose:** A zero-dependency TypeScript decorator primitives library that simplify creation of decorators.

**Core flow:**

1. `Wrap` / `WrapOnMethod` / `WrapOnClass` (src/) — Foundational decorator primitives. `WrapOnMethod` wraps a single method with lazy initialization: the factory runs once on first invocation with a method proxy and `WrapContext`. `WrapOnClass` iterates prototype methods and applies `WrapOnMethod` to each. `Wrap` dispatches to one or the other based on argument count.
2. `Effect` (src/effect.decorator.ts) — Higher-level abstraction built on `Wrap` that provides lifecycle hooks (onInvoke, onReturn, onError, finally). Builds a `HookContext` (args, argsObject, target, propertyKey, descriptor, parameterNames, className) per invocation.
3. `buildArgsObject` (src/effect.decorator.ts) — Maps parameter names to their call-time values to produce the pre-built `argsObject` passed in every `HookContext`.
