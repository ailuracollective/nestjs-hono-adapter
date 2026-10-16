// oxlint-disable promise/prefer-await-to-callbacks, eslint/no-underscore-dangle -- an Express engine is defined by its callback, and `__express` is the name Express reads.
import { expect, test } from 'bun:test';

import { adaptEngine } from '#adapter/features/views/renderer/engines';
import type { Renderer, ViewData } from '#adapter/features/views/types';

const render = (
  renderer: Renderer | undefined,
  source: string,
  data: ViewData,
): Promise<string> => {
  if (renderer === undefined) throw new TypeError('the module answered no engine');
  if (renderer.kind === 'file') throw new TypeError('the module answered an Express engine');
  return Promise.resolve(renderer.render(source, data));
};

const upper = (template: string): string => template.toUpperCase();

test('a module that is a function renders with it', async () => {
  const engine = adaptEngine((source: string, data: { name?: unknown }) =>
    source.replace('{{name}}', String(data.name)),
  );

  expect(await render(engine, 'hi {{name}}', { name: 'Ada' })).toBe('hi Ada');
});

test('a module that carries a render renders with it', async () => {
  const engine = adaptEngine({
    render: (source: string) => `[${source}]`,
  });

  expect(await render(engine, 'x', {})).toBe('[x]');
});

test('the default export answers when the namespace does not', async () => {
  const engine = adaptEngine({
    default: (source: string) => source.toUpperCase(),
  });

  expect(await render(engine, 'x', {})).toBe('X');
});

test('a module with nothing to render with answers nothing', () => {
  expect(adaptEngine({})).toBeUndefined();
});

test('an Express engine is kept as a file renderer', () => {
  const express = {
    __express: (
      _filePath: string,
      _data: ViewData,
      callback: (error: unknown, html?: string) => void,
    ): void => {
      callback(undefined, 'html');
    },
  };

  expect(adaptEngine(express)).toStrictEqual({ kind: 'file', render: express.__express });
  expect(adaptEngine({ default: express })).toStrictEqual({
    kind: 'file',
    render: express.__express,
  });
});

test('an engine the views option names renders from the source', () => {
  expect(adaptEngine(upper)).toStrictEqual({ kind: 'source', render: upper });
});
