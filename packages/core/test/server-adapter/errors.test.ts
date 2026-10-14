import { expect, test } from 'bun:test';
import { BadRequestException } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { startProbe } from '#adapter-test/support/index';

test('the adapter reports itself to Nest', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    expect(probe.adapter.getType()).toBe('hono');
    expect(probe.adapter.isRouteOrderSensitive()).toBe(false);
    expect(probe.adapter.getHono()).toBeDefined();
  } finally {
    await probe.close();
  }
});

test('an error the framework raised is mapped to a bad request', () => {
  const adapter = bunAdapter();
  const mapped = adapter.mapException(
    new URIError('URI malformed'),
  );
  expect(mapped).toBeInstanceOf(BadRequestException);
  expect(mapped).toMatchObject({ message: 'URI malformed' });
});

test('an invalid JSON body is mapped to a bad request too', () => {
  const adapter = bunAdapter();
  expect(
    adapter.mapException(new SyntaxError('Unexpected token')),
  ).toBeInstanceOf(BadRequestException);
});

test('an error of no known shape is passed through unchanged', () => {
  const adapter = bunAdapter();
  const error = new Error('nothing the framework owns');
  expect(adapter.mapException(error)).toBe(error);
});
