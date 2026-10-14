import { expect, test } from 'bun:test';

import {
  ALLOWED,
  CROSS_SITE,
  FOREIGN,
  NO_CONTENT,
  OK,
  bridged,
  headerText,
  namedOrigin,
} from './support.ts';

test('a preflight for a deployment that names no origin allows it', async () => {
  const response = await bridged({}).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: FOREIGN,
    },
    method: 'OPTIONS',
  });

  expect(response.status).toBe(NO_CONTENT);
  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe('*');
});

test('a preflight is answered before any route is reached', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: ALLOWED,
    },
    method: 'OPTIONS',
  });

  expect(response.status).toBe(NO_CONTENT);
  expect(
    headerText(
      response.headers.get('access-control-allow-methods'),
    ),
  ).toMatch(/POST/u);
  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
});

test('a preflight for a foreign origin carries nothing', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: FOREIGN,
    },
    method: 'OPTIONS',
  });

  expect(response.status).toBe(NO_CONTENT);
  expect(namedOrigin(response)).toBe(false);
});

test('a preflight asked to continue reaches the router', async () => {
  const response = await bridged({
    origin: [ALLOWED],
    preflightContinue: true,
  }).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: ALLOWED,
    },
    method: 'OPTIONS',
  });

  expect(response.status).toBe(OK);
  expect(await response.text()).toBe('reached');
  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
});

test('a preflight names every method the deployment answers', async () => {
  const response = await bridged(CROSS_SITE).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: ALLOWED,
    },
    method: 'OPTIONS',
  });

  const methods = headerText(
    response.headers.get('access-control-allow-methods'),
  ).split(',');
  expect(methods).toContain('POST');
  expect(methods).toContain('OPTIONS');
});
