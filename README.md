<div align="center">

<h1>TypeScript Base Decorators</h1>

![Build Status](https://github.com/neolabhq/base-decorators/actions/workflows/build.yaml/badge.svg)
[![npm version](https://img.shields.io/npm/v/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![NPM Downloads](https://img.shields.io/npm/dw/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

Basic decorator primitives for TypeScript. Writing decorators in TS is hard, this library make it simpler.

[Quick Start](#quick-start) •
[How It Works](#how-it-works) •
[Usage](#usage) •
[Options](#options) •
[API Reference](#api-reference) •
[Advanced Example](#advanced-example)

</div>

## Description

### Key Features

## Installation

```bash
npm install base-decorators
```

## API Reference

| Export | Type | Description |
|--------|------|-------------|
| `Effect` | Decorator | Unified class+method decorator with lifecycle hooks |
| `EffectOnMethod` | Decorator | Method decorator with lifecycle hooks |
| `EffectOnClass` | Decorator | Class decorator that applies hooks to all methods |
| `SetMeta` | Decorator | Store metadata on methods |
| `getMeta` | Function | Retrieve metadata from methods |
| `setMeta` | Function | Programmatically set metadata on functions |
| `EFFECT_APPLIED_KEY` | Symbol | Key used to mark methods as already decorated |
| `OnInvokeHook` | Decorator | Convenience hook for `onInvoke` |
| `OnReturnHook` | Decorator | Convenience hook for `onReturn` |
| `OnErrorHook` | Decorator | Convenience hook for `onError` |
| `FinallyHook` | Decorator | Convenience hook for `finally` |
