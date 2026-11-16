import { afterAll, beforeAll, expect, test } from 'bun:test';
import { NestFactory } from '@nestjs/core';
import { ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { fetchServer } from '@ailura/nestjs-hono-adapter/fetch';

import { BaseModule } from '#benchmarks/app/base.module';

const BAD_REQUEST = 400;
const adapter = new ServerAdapter({ transport: fetchServer() });
const app = NestFactory.create(BaseModule, adapter, { logger: false });
beforeAll(async () => {
  const ready = await app;
  await ready.init();
});
afterAll(async () => {
  const ready = await app;
  await ready.close();
});

test('plaintext is text rather than a second JSON scenario', async () => {
  const text = await adapter.getHono().request('/health');
  expect(await text.text()).toBe('OK');
  expect(text.headers.get('content-type')).toStartWith('text/');
});

test('base scenarios serve middleware, a pipe and a drained stream', async () => {
  const middleware = await adapter.getHono().request('/middleware');
  expect(await middleware.json()).toEqual({ ok: true });
  const piped = await adapter.getHono().request('/pipes/42');
  expect(await piped.json()).toEqual({ id: 42 });
  const invalid = await adapter.getHono().request('/pipes/not-a-number');
  expect(invalid.status).toBe(BAD_REQUEST);
  const stream = await adapter.getHono().request('/stream');
  expect(await stream.text()).toBe('hello world');
});
