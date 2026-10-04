import { expect, test } from 'bun:test';

import { Hono } from 'hono';

import type { NodeEnv } from '../src/core/context.ts';
import {
  corsBridge,
  corsMiddleware,
} from '../src/features/cors-middleware.ts';
import type { CorsOptions } from '../src/features/cors-middleware.ts';

const ALLOWED = 'https://child.example.com';
const FOREIGN = 'https://somewhere.else.example';

/**
 * The status a request that named no origin is still answered
 * with.
 */
const OK = 200;

/**
 * The status a preflight is answered with, as the specification
 * asks.
 */
const NO_CONTENT = 204;

/** The status a request whose handling threw is answered with. */
const SERVER_ERROR = 500;

/** A service with CORS configured the way the bootstrap does it. */
function service(options: CorsOptions): Hono<NodeEnv> {
  const hono = new Hono<NodeEnv>();

  hono.use('*', corsMiddleware(options));
  hono.get('/', (context) => context.text('ok'));
  hono.post('/', (context) => context.text('ok'));

  return hono;
}

/**
 * A service that configures CORS the way an application does:
 * the options are read per request, so an origin callback can
 * decide for each one.
 */
function bridged(options: CorsOptions): Hono<NodeEnv> {
  const hono = new Hono<NodeEnv>();

  hono.use(
    '*',
    corsBridge(() => options),
  );
  hono.onError((_error, context) =>
    context.text('failed', SERVER_ERROR),
  );
  hono.get('/', (context) => context.text('ok'));
  hono.options('/', (context) => context.text('reached'));

  return hono;
}

/**
 * The CORS options a deployment that serves its own clients
 * uses.
 */
const CROSS_SITE: CorsOptions = {
  credentials: true,
  origin: [ALLOWED],
};

/** Whether a response named an origin at all. */
function namedOrigin(response: Response): boolean {
  return (
    response.headers.get('access-control-allow-origin') !== null
  );
}

/**
 * The text of a header, empty when the response named none:
 * `Headers.get` answers `null` for a header that is absent,
 * where matching asks for a string.
 */
function headerText(value: string | null): string {
  if (value === null) {
    return '';
  }

  return value;
}

test('an allowed origin is echoed back with credentials', async () => {
  const response = await service(CROSS_SITE).request('/', {
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
  const response = await service(CROSS_SITE).request('/', {
    headers: { origin: FOREIGN },
  });

  expect(namedOrigin(response)).toBe(false);
  expect(response.status).toBe(OK);
  expect(await response.text()).toBe('ok');
});

test('a request no browser sent is left alone', async () => {
  const response = await service(CROSS_SITE).request('/');

  expect(namedOrigin(response)).toBe(false);
});

test('a deployment that allows nothing writes nothing', async () => {
  const response = await service({
    credentials: true,
    origin: [],
  }).request('/', { headers: { origin: ALLOWED } });

  expect(namedOrigin(response)).toBe(false);
});

test('a deployment may allow any origin', async () => {
  const response = await service({
    credentials: true,
    origin: true,
  }).request('/', { headers: { origin: FOREIGN } });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(FOREIGN);
});

test('an origin may be matched by a pattern', async () => {
  const response = await service({
    credentials: true,
    origin: [/^https:\/\/[a-z]+\.example\.com$/u],
  }).request('/', { headers: { origin: ALLOWED } });

  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
});

test('a preflight is answered before any route is reached', async () => {
  const response = await service(CROSS_SITE).request('/', {
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
    headerText(
      response.headers.get('access-control-allow-headers'),
    ),
  ).toMatch(/x-csrf-token/u);
  expect(
    response.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
});

test('a preflight for a foreign origin carries nothing', async () => {
  const response = await service(CROSS_SITE).request('/', {
    headers: {
      'access-control-request-method': 'POST',
      origin: FOREIGN,
    },
    method: 'OPTIONS',
  });

  expect(response.status).toBe(NO_CONTENT);
  expect(namedOrigin(response)).toBe(false);
});

test('an origin callback decides for each request', async () => {
  const decided: CorsOptions = {
    origin: (origin, respond) => {
      respond(undefined, origin === ALLOWED);
    },
  };

  const allowed = await bridged(decided).request('/', {
    headers: { origin: ALLOWED },
  });
  const foreign = await bridged(decided).request('/', {
    headers: { origin: FOREIGN },
  });

  expect(
    allowed.headers.get('access-control-allow-origin'),
  ).toBe(ALLOWED);
  expect(namedOrigin(foreign)).toBe(false);
});

test('an origin callback that fails fails the request', async () => {
  const decided: CorsOptions = {
    origin: (_origin, respond) => {
      respond(new TypeError('a foreign origin'));
    },
  };

  const response = await bridged(decided).request('/', {
    headers: { origin: ALLOWED },
  });

  expect(response.status).toBe(SERVER_ERROR);
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
