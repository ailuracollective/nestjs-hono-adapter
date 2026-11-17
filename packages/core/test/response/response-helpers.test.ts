import { expect, test } from 'bun:test';
import { Context } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { finalizeOnResponse, whenResponseSettled } from '#adapter/core/response/response-helpers';

const context = (): Context<NestEnv> => new Context<NestEnv>(new Request('http://localhost/'));

test('settlement is cached per context, not shared between concurrent requests', async () => {
  const first = context();
  const second = context();
  const firstSettled = whenResponseSettled(first);
  const secondSettled = whenResponseSettled(second);
  expect(secondSettled).not.toBe(firstSettled);
  first.res = new Response('first');
  await firstSettled;
  expect(await Promise.race([secondSettled, Promise.resolve('pending')])).toBe('pending');
  second.res = new Response('second');
  await secondSettled;
});

test('settlement is installed once per context', () => {
  const current = context();
  expect(whenResponseSettled(current)).toBe(whenResponseSettled(current));
});

test('reading or preparing response headers does not settle the response', async () => {
  const current = context();
  const settled = whenResponseSettled(current);
  current.header('x-before', 'kept');
  expect(current.res.headers.get('x-before')).toBe('kept');
  expect(await Promise.race([settled, Promise.resolve('pending')])).toBe('pending');
  current.res = new Response('done');
  await settled;
});

test('the original Hono setter preserves headers and multiple cookies', async () => {
  const current = context();
  current.res.headers.append('set-cookie', 'one=1');
  current.res.headers.append('set-cookie', 'two=2');
  const settled = whenResponseSettled(current);
  current.res = new Response('first');
  await settled;
  current.res = new Response('second');
  expect(current.res.headers.getSetCookie()).toEqual(['one=1', 'two=2']);
  expect(await current.res.text()).toBe('second');
});

test('extracted helpers still finalize and settle a middleware response', async () => {
  const current = context();
  finalizeOnResponse(current);
  const settled = whenResponseSettled(current);
  const { json } = current;
  const response = json({ ok: true });
  await settled;
  expect(current.finalized).toBe(true);
  expect(await current.res.json()).toEqual({ ok: true });
  expect(response.status).toBe(current.res.status);
});
