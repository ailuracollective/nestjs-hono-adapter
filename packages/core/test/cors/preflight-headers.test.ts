import { expect, test } from 'bun:test';

import {
  ALLOWED,
  CROSS_SITE,
  bridged,
  headerText,
} from './support.ts';

test('a preflight reflects the headers it asks for', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: {
      'access-control-request-headers':
        'x-custom-auth, x-tenant',
      'access-control-request-method': 'POST',
      origin: ALLOWED,
    },
    method: 'OPTIONS',
  });

  expect(
    headerText(
      response.headers.get('access-control-allow-headers'),
    ),
  ).toBe('x-custom-auth,x-tenant');
  expect(response.headers.get('vary')).toMatch(
    /access-control-request-headers/iu,
  );
});

test('a configured header list answers instead of reflecting', async () => {
  const response = await bridged({
    allowedHeaders: ['x-only'],
    origin: [ALLOWED],
  }).request('/', {
    headers: {
      'access-control-request-headers': 'x-custom-auth',
      'access-control-request-method': 'POST',
      origin: ALLOWED,
    },
    method: 'OPTIONS',
  });

  expect(
    headerText(
      response.headers.get('access-control-allow-headers'),
    ),
  ).toBe('x-only');
});

test('a preflight carries the fastify max age by default', async () => {
  const preflight = {
    'access-control-request-method': 'POST',
    origin: ALLOWED,
  };
  const probe = await bridged(CROSS_SITE).request('/', {
    headers: preflight,
    method: 'OPTIONS',
  });
  const configured = await bridged({
    maxAge: 60,
    origin: [ALLOWED],
  }).request('/', { headers: preflight, method: 'OPTIONS' });

  expect(probe.headers.get('access-control-max-age')).toBe(
    '86400',
  );
  expect(configured.headers.get('access-control-max-age')).toBe(
    '60',
  );
});
