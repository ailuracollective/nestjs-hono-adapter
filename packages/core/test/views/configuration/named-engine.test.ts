import { expect, test } from 'bun:test';

import { adaptEngine } from '#adapter/features/views/renderer/engines';
import type { ViewData, ViewEngine } from '#adapter/features/views/types';

const render = (
  engine: ViewEngine | undefined,
  source: string,
  data: ViewData,
): Promise<string> => {
  if (engine === undefined) throw new TypeError('the module answered no engine');
  return Promise.resolve(engine(source, data));
};

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
