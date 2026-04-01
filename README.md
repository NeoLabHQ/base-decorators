<div align="center">

<h1>TypeScript Base Decorators</h1>

![Build Status](https://github.com/neolabhq/base-decorators/actions/workflows/build.yaml/badge.svg)
[![npm version](https://img.shields.io/npm/v/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![NPM Downloads](https://img.shields.io/npm/dw/base-decorators)](https://www.npmjs.com/package/base-decorators)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://opensource.org/licenses/AGPL-3.0)

Basic decorator primitives for TypeScript. Writing decorators in TS is hard, this library makes it simpler.

[Quick Start](#quick-start) •
[How It Works](#how-it-works) •
[Usage](#usage) •
[Options](#options) •
[API Reference](#api-reference) •
[Advanced Example](#advanced-example)

</div>

## Description

Zero-dependency TypeScript library that provides low-level primitives for creating decorators. Instead of wrestling with property descriptors and prototype traversal, you define a decorator from base hooks:

- `onInvoke` — fired before the method runs
- `onReturn` — fired after the method succeeds
- `onError` — fired when the method throws
- `finally` — fired after either success or failure

The library handles method wrapping, `this` preservation, async/sync support, parameter name extraction, and metadata management so you can focus on your decorator logic.

### Key Features

- **Zero dependencies** — tiny footprint, no external packages required
- **Unified decorator** — `Effect` works on both classes and methods
- **Full async support** — promises are handled automatically with `.then`, `.catch`, and `.finally`
- **Pre-built args object** — arguments are mapped to parameter names and passed into every hook
- **Metadata utilities** — `SetMeta`, `getMeta`, and `setMeta` for symbol-keyed method metadata
- **TypeScript native** — written in TypeScript with full type definitions

## Installation

```bash
npm install base-decorators
```

## Quick Start

```typescript
import { Effect } from 'base-decorators';

class Calculator {
  @Effect({
    onInvoke: ({ args }) => console.log('add called with', args),
    onReturn: ({ result }) => { console.log('result:', result); return result; },
  })
  add(a: number, b: number) {
    return a + b;
  }
}

const calc = new Calculator();
calc.add(2, 3); // logs arguments and result
```

## How It Works

Instead of creating a custom property descriptor wrapper, you can simply compose decorator hooks to get the desired behavior.

```typescript
import { Effect } from 'base-decorators';

/** Logs on invoke and return */
const Log = () => Effect({
    onInvoke: ({ args }) => console.log('add called with', args),
    onReturn: ({ result }) => { console.log('result:', result); return result; },
})

class Calculator {
  
  @Log()
  add(a: number, b: number) {
    return a + b;
  }
}
```

## Usage

### Validate arguments with `OnInvokeHook`

```typescript
import { OnInvokeHook } from 'base-decorators';

const Validate = () => OnInvokeHook(({ args: [name] }) => {
  if (name.startsWith('!')) {
    throw new Error('Invalid name: ' + name);
  }
});

class Service {

  @Validate()
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

### Handle errors with `OnErrorHook`

```typescript
import { OnErrorHook } from 'base-decorators';

const HandleError = () => OnErrorHook(({ error }) => {
    if(error instanceof AxiosError) {
        throw new ApiException(error.response?.data);
    }
    throw error;
});

class Service {
  @HandleError()
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

### Validate return value with `OnReturnHook`

```typescript
import { OnReturnHook } from 'base-decorators';

const ValidateReturn = () => OnReturnHook(({ result }) => {
  if (result.length > 10) {
    throw new Error('Result is too long');
  }
});

class Service {
  @ValidateReturn()
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

### Async hooks

When the decorated method returns a `Promise`, all hooks may optionally return a `Promise` as well. `onReturn` receives the **unwrapped** resolved value, and the library automatically chains the returned promise so async hooks execute in the correct order.

```typescript
import { Effect } from 'base-decorators';

const DelayedLog = () => Effect({
  // Returning a Promise delays the original method
  onInvoke: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    console.log('starting...');
  },

  // `result` is the unwrapped string, not Promise<string>
  onReturn: async ({ result }) => {
    console.log('done:', result);
    return `${result} (modified)`;
  },
});

class Service {
  @DelayedLog()
  async greet(name: string): Promise<string> {
    return `Hello, ${name}`;
  }
}

const service = new Service();
const value = await service.greet('World');
// "Hello, World (modified)"
```

Async `onError` and `finally` hooks work the same way. Here, an async `finally` flushes a log buffer after every call:

```typescript
import { Effect } from 'base-decorators';

const buffer: string[] = [];

const FlushAfterCall = () => Effect({
  onInvoke: ({ args }) => {
    buffer.push('invoke: ' + String(args));
  },
  finally: async () => {
    await fetch('/log', { method: 'POST', body: JSON.stringify(buffer) });
    buffer.length = 0;
  },
});

class Worker {
  @FlushAfterCall()
  async doWork(id: number): Promise<void> {
    // async work
  }
}
```

### Class and Method decorators

`Effect` and all hook decorators can be used on both classes and methods out of the box.

```typescript
import { Effect } from 'base-decorators';

const Log = (message: string) => Effect({ 
    onInvoke: () => console.log(message) 
})

// Method-level
class Service {
  @Log('doWork invoked')
  doWork() { return 42; }
}

// Class-level
@Log('AnotherService invoked') // automatically applied to all methods
class AnotherService {
  // will be logged as "AnotherService invoked"
  methodA() { return 'a'; }
  
  @Log('methodB invoked') // will be logged as "methodB invoked"
  methodB() { return 'b'; }
}
```

A method-level decorator takes precedence over a class-level decorator to avoid duplicated behavior. If you want one type of decorator applied at class level while another is applied at method level, you can pass `exclusionKey` to the decorator. That way you can create a namespace in which your decorators stay isolated.

#### Incorrect

```typescript
const Log = (message: string) => Effect({ 
    onInvoke: () => console.log(message) 
});

const Validate = () => Effect({ 
    onInvoke: ({ args }) => {
        if (args.length !== 1) {
            throw new Error('Invalid arguments');
        }
    }
});

@Validate()
class Service {
  @Log() // only log decorator applied
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

#### Correct

```typescript
const Log = (message: string) => Effect({ 
    onInvoke: () => console.log(message) 
});

const Validate = () => Effect({ 
    onInvoke: ({ args }) => {
        if (args.length !== 1) {
            throw new Error('Invalid arguments');
        }
    }
}, Symbol('validate'));

@Validate()
class Service {
  @Log() // both validate and log decorators applied
  greet(name: string) {
    return `Hello, ${name}`;
  }
}
```

### Metadata

Store and retrieve symbol-keyed metadata on methods:

```typescript
import { SetMeta, getMeta, setMeta } from 'base-decorators';

const SKIP_ARGS = Symbol('skip');

const SkipArgs = () => SetMeta(SKIP_ARGS, true);

const Log = () => Effect({ 
    onInvoke: ({args, descriptor}) => {
        const skipArgs = getMeta<boolean>(SKIP_ARGS, descriptor);
        if(skipArgs) {
            console.log('function called')
            return;
        }
        console.log('function called with', args)
    } 
});

@Log()
class Service {

  @SkipArgs()
  private internal(counter: number) { return 'skip me: ' + counter; }
}
```

## Options

### Effect lifecycle hooks

Each hook receives a context object. All hooks are optional. Each hook has a corresponding convenience decorator.

| Hook | When it fires | Return value |
|------|---------------|--------------|
| `onInvoke` | Before the original method executes | Ignored |
| `onReturn` | After the method returns successfully | Replaces the method result |
| `onError` | When the method throws an error | Replaces the thrown error (return a value or re-throw) |
| `finally` | After `onReturn` or `onError`, regardless of outcome | Ignored |

### HookContext

```typescript
interface HookContext {
  args: unknown[];                                 // raw arguments
  argsObject: Record<string, unknown> | undefined; // mapped parameter names
  target: object;                                  // class instance (this)
  propertyKey: string | symbol;                    // method name
  parameterNames: string[];                        // extracted parameter names
  className: string;                               // runtime class name
  descriptor: PropertyDescriptor;                  // method descriptor
}
```

For `onReturn`, the context also includes `result`. For `onError`, it includes `error`.

### Exclusion keys

You can pass an optional `exclusionKey` symbol to `Effect` or to any hook decorator. That prevents the same method from being wrapped twice when both class-level and method-level decorators are used. You can also mark methods to skip wrapping with `@SetMeta(exclusionKey, true)`.

```typescript
const EXCLUDE = Symbol('exclude');

@Effect({ onInvoke: () => console.log('called') }, EXCLUDE)
class Service {
  included() { return 'wrapped'; }

  @SetMeta(EXCLUDE, true)
  excluded() { return 'skipped'; }
}
```

### Factory Hooks

In addition to a static hooks object, `Effect` accepts a **factory function** that receives the current `HookContext` and returns an `EffectHooks` object. This is useful when you need to decide which hooks (or what behavior) to apply at runtime based on the method being invoked.

```typescript
import { Effect } from 'base-decorators';
import type { HookContext, EffectHooks } from 'base-decorators';

const DynamicHooks = Effect(({className}: HookContext): EffectHooks => {
  if (className === 'DebugService') {
    return {
      onInvoke: ({ args }) => console.log('debug invoke', args),
      onReturn: ({ result }) => result,
    };
  }

  return {
    onReturn: ({ result }) => result,
  };
});

class DebugService {
  @DynamicHooks()
  compute(value: number) {
    return value * 2;
  }
}
```

The factory is called **once per method invocation**, immediately before `onInvoke`, so it can inspect `args`, `propertyKey`, `className`, and every other field on `HookContext`.

## API Reference

| Export | Type | Description |
|--------|------|-------------|
| `Effect` | Decorator | Unified class+method decorator with lifecycle hooks |
| `SetMeta` | Decorator | Store metadata on methods |
| `getMeta` | Function | Retrieve metadata from methods |
| `setMeta` | Function | Programmatically set metadata on functions |
| `OnInvokeHook` | Decorator | Convenience hook for `onInvoke` |
| `OnReturnHook` | Decorator | Convenience hook for `onReturn` |
| `OnErrorHook` | Decorator | Convenience hook for `onError` |
| `FinallyHook` | Decorator | Convenience hook for `finally` |

## Advanced Example

Build a reusable `@Timer` decorator that logs how long each method takes, and skip internal helpers with `@SetMeta`:

```typescript
import { Effect, SetMeta } from 'base-decorators';
import type { EffectHooks } from 'base-decorators';

const TIMER_KEY = Symbol('timer');

const Timer = (label?: string) => Effect({
    onInvoke: ({ className, propertyKey }) => {
        const timerLabel = label ?? `${className}.${String(propertyKey)}`;
        console.time(timerLabel);
    },
    finally: ({ className, propertyKey }) => {
        const timerLabel = label ?? `${className}.${String(propertyKey)}`;
        console.timeEnd(timerLabel);
    },
}, TIMER_KEY);

const SkipTimer = () => SetMeta(TIMER_KEY, true);

// Usage on a method
class UserService {
  @Timer()
  async fetchUser(id: number) {
    // fetch logic
    return { id, name: 'Alice' };
  }
}

// Usage on a class — skip internal helpers
@Timer()
class OrderService {
  createOrder() { /* timed */ }

  @SkipTimer()
  private internalHelper() { /* skipped */ }
}
```
