import { isRecord } from '#adapter/core/request/query/index';

import type { ExpressViewEngine, Renderer, ViewEngine } from './types.ts';

type Callable = (...args: never[]) => unknown;

const isCallable = (value: unknown): value is Callable => typeof value === 'function';

const carried = (holder: unknown, name: string): Callable | undefined => {
  if (!isRecord(holder)) return undefined;
  const value: unknown = Reflect.get(holder, name);
  return isCallable(value) ? value : undefined;
};

const fileRenderer = (value: Callable): Renderer => ({
  kind: 'file',
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the call site says which selector it is.
  render: value as ExpressViewEngine,
});

const sourceRenderer = (value: Callable): Renderer => ({
  kind: 'source',
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the call site says which selector it is.
  render: value as ViewEngine,
});

/**
 * Reads either selector. `app.engine()` names the Express one, so a function it is given renders
 * the file; the `views.engine` option and `setViewEngine({ engine })` name the adapter's one, so a
 * function they are given renders the source. Either way the module's `__express` — the hook
 * Express itself looks for — is the Express engine.
 */
const rendererOf = (value: unknown, kind: 'file' | 'source'): Renderer | undefined => {
  if (isCallable(value)) return kind === 'file' ? fileRenderer(value) : sourceRenderer(value);

  const express = carried(value, '__express');
  if (express !== undefined) return fileRenderer(express);

  const render = carried(value, 'render');
  if (render !== undefined) return kind === 'file' ? fileRenderer(render) : sourceRenderer(render);

  return undefined;
};

export { rendererOf };
