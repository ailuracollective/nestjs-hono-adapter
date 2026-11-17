import { expect, test } from 'bun:test';

import type { CorsOptions } from '#adapter/features/cors/index';
import { ALLOWED, FOREIGN, SERVER_ERROR, bridged, namedOrigin } from './support.ts';

test('an origin callback decides for each request', async () => {
  const decided: CorsOptions = {
    origin: (origin, respond) => {
      respond(undefined, origin === ALLOWED);
    },
  };
  const app = bridged(decided);
  const allowed = await app.request('/', {
    headers: { origin: ALLOWED },
  });
  const foreign = await app.request('/', {
    headers: { origin: FOREIGN },
  });

  expect(allowed.headers.get('access-control-allow-origin')).toBe(ALLOWED);
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

test('a delegate decides the options for each request', async () => {
  const response = await bridged((request, answer) => {
    // oxlint-disable-next-line unicorn/no-null -- the callback reports "no error" as null, the way Nest and the cors package define it.
    answer(null, { origin: [request.headers.origin ?? ''] });
  }).request('/', {
    headers: { origin: ALLOWED },
  });

  expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED);
});

test('the options a delegate answers are the ones applied', async () => {
  const response = await bridged((_request, answer) => {
    // oxlint-disable-next-line unicorn/no-null -- the callback reports "no error" as null, the way Nest and the cors package define it.
    answer(null, { credentials: true, origin: [ALLOWED] });
  }).request('/', {
    headers: { origin: ALLOWED },
  });

  expect(response.headers.get('access-control-allow-credentials')).toBe('true');
});

test('asynchronous delegates and origin callbacks are both awaited', async () => {
  const app = bridged((_request, answer) => {
    queueMicrotask(() => {
      // oxlint-disable-next-line unicorn/no-null -- Nest's CORS delegate reports success with null.
      answer(null, {
        origin: (origin, respond) => {
          queueMicrotask(() => {
            respond(undefined, origin === ALLOWED);
          });
        },
      });
    });
  });
  const response = await app.request('/', { headers: { origin: ALLOWED } });
  expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED);
});

test('an asynchronous delegate failure still reaches the error handler', async () => {
  const app = bridged((_request, answer) => {
    queueMicrotask(() => {
      answer(new TypeError('failed options'), {});
    });
  });
  const response = await app.request('/', { headers: { origin: ALLOWED } });
  expect(response.status).toBe(SERVER_ERROR);
});

test('static options are read again rather than cached across requests', async () => {
  const options = { origin: ALLOWED };
  const app = bridged(options);
  const first = await app.request('/', { headers: { origin: ALLOWED } });
  Object.assign(options, { origin: FOREIGN });
  const second = await app.request('/', { headers: { origin: FOREIGN } });
  expect(first.headers.get('access-control-allow-origin')).toBe(ALLOWED);
  expect(second.headers.get('access-control-allow-origin')).toBe(FOREIGN);
});

test('an origin getter is evaluated once per request', async () => {
  let reads = 0;
  const options = {
    get origin(): string {
      reads += 1;
      return ALLOWED;
    },
  };
  const response = await bridged(options).request('/', { headers: { origin: ALLOWED } });
  expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED);
  expect(reads).toBe(1);
});
