// Internal (not exported): wrap-on-class.ts
export { wrapMethod as wrapFunction, buildArgsObject } from './wrap-on-method';
export type { WrapMethodOptions } from './wrap-on-method';
export * from './wrap.decorator';
export * from './effect.decorator';

export type * from './hook.types';
export * from './set-meta.decorator';

// Hook decorator functions (values)
export * from './on-invoke.hook';
export * from './on-return.hook';
export * from './on-error.hook';
export * from './finally.hook';
