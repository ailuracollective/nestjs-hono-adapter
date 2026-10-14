import { expect, test } from 'bun:test';

import type { CorsOptions } from '#adapter/features/cors/index';
import { ALLOWED, FOREIGN, SERVER_ERROR, bridged, namedOrigin } from './support.ts';

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
