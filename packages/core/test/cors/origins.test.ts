import { expect, test } from 'bun:test';

import {
  ALLOWED,
  CROSS_SITE,
  FOREIGN,
  OK,
  bridged,
  namedOrigin,
} from './support.ts';

test('an allowed origin is echoed back with credentials', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: { origin: ALLOWED },
  });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
  expect(
    response.headers.get('access-control-allow-credentials'),
  ).toBe('true');
  expect(response.headers.get('vary')).toBe('Origin');
});

test('a foreign origin is answered without anything for it', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: { origin: FOREIGN },
  });

  expect(namedOrigin(response)).toBe(false);
  expect(response.status).toBe(OK);
  expect(await response.text()).toBe('ok');
});

test('a request no browser sent is left alone', async () => {
  const response = await bridged(CROSS_SITE).request('/');

  expect(namedOrigin(response)).toBe(false);
});

test('a deployment that allows nothing writes nothing', async () => {
  const response = await bridged({
    credentials: true,
    origin: [],
  }).request('/', { headers: { origin: ALLOWED } });

  expect(namedOrigin(response)).toBe(false);
});

test('a deployment that names no origin allows every one', async () => {
  const response = await bridged({}).request('/', {
    headers: { origin: FOREIGN },
  });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe('*');
});

test('a deployment may allow any origin', async () => {
  const response = await bridged({
    credentials: true,
    origin: true,
  }).request('/', { headers: { origin: FOREIGN } });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(FOREIGN);
});

test('an origin may be matched by a pattern', async () => {
  const response = await bridged({
    credentials: true,
    origin: [/^https:\/\/[a-z]+\.example\.com$/u],
  }).request('/', { headers: { origin: ALLOWED } });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
});

test('an origin of * is answered literally', async () => {
  const response = await bridged({ origin: '*' }).request('/', {
    headers: { origin: FOREIGN },
  });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe('*');
  expect(response.headers.get('vary')).toBeNull();
});
