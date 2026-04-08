---
title: Add wrap decorator
---

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

## Description

// Will be filled in future stages by business analyst
