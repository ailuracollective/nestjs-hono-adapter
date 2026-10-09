/**
 * The cases that show `@nestjs/throttler` works on this
 * adapter.
 *
 * The package answers a request from a guard rather than from a
 * route, and it answers it with a status the route never names.
 * That is what makes it worth a case here: a guard refusing is
 * the clearest way to show Nest's own exception layer produces
 * the answer and the adapter passes it on, down to the status
 * and the body the package wrote.
 *
 * The count a limit is measured against is keyed by the client
 * the tracker names, and on the in-process path there is no
 * client — so every request in a case shares one tracker, which
 * is what lets the limit be crossed deliberately rather than by
 * accident.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** How many requests a case may make before the guard refuses. */
const LIMIT = 3;

/** How long a window lasts, in milliseconds. */
const TTL = 60_000;

/**
 * The client every request is tracked as. The tracker names it,
 * so the requests a case makes share one key rather than one
 * each.
 */
const TRACKER = 'the-same-client';

/** How far into the window a case reads the remaining count. */
const TWO_REQUESTS = 2;

/**
 * What the route answers with while it is still under the
 * limit.
 */
const ALLOWED = { allowed: true };

@Controller()
class ThrottledController {
  @Get('ping')
  public ping(): typeof ALLOWED {
    return ALLOWED;
  }

  /**
   * A route that is never reached, named so a case can tell a
   * guard that refused from a route that answered slowly: the
   * difference is the status, not a body either route wrote.
   */
  @Get('once')
  public once(): typeof ALLOWED {
    return ALLOWED;
  }
}

/**
 * The application under the guard, with a tracker that names
 * every client the same. The default tracker reads the client
 * address, and on the in-process path that address is the one a
 * request that never arrived would have — so the requests would
 * already share a key. Naming it makes the sharing the case's
 * decision.
 */
@Module({
  controllers: [ThrottledController],
  imports: [
    ThrottlerModule.forRoot([
      {
        getTracker: (): string => TRACKER,
        limit: LIMIT,
        ttl: TTL,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottledModule {}

/**
 * Starts the fixture with an empty record of the requests made,
 * so a case's count starts from nothing however many the last
 * one made.
 */
async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  const probe = await startProbe({
    mode: 'in-process',
    module: ThrottledModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

/**
 * The record the guard counts against, emptied for a fresh
 * case.
 */
/**
 * Makes the requests that fill a window. They are issued
 * together rather than one after another because the count is
 * what is under test and the order two identical requests
 * arrive in is not.
 */
async function exhaust(
  probe: Probe,
  path: string,
): Promise<void> {
  await Promise.all(
    Array.from({ length: LIMIT }, () => request(probe, path)),
  );
}

test('a request under the limit is answered by the route', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(ALLOWED);
  });
});

test('the guard writes the limit it was given onto the answer', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');

    // The official suite asserts these three by name, on allowed
    // responses as well as refused ones: the guard is the only
    // thing in the request that writes them, so their absence means
    // the adapter dropped what the guard set.
    expect(response.headers.get('x-ratelimit-limit')).toBe(
      String(LIMIT),
    );
  });
});

test('the guard counts down what is left of the window', async () => {
  await withProbe(async (probe) => {
    const first = await request(probe, '/ping');
    const second = await request(probe, '/ping');

    expect(first.headers.get('x-ratelimit-remaining')).toBe(
      String(LIMIT - 1),
    );
    expect(second.headers.get('x-ratelimit-remaining')).toBe(
      String(LIMIT - TWO_REQUESTS),
    );
  });
});

test('the guard says when the window ends', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/ping');
    const reset = response.headers.get('x-ratelimit-reset');

    expect(reset).not.toBeNull();
    expect(Number(reset)).toBeGreaterThan(0);
  });
});

test('the three limit headers travel together', async () => {
  await withProbe(async (probe) => {
    const { headers } = await request(probe, '/ping');

    for (const name of [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
    ]) {
      expect(headers.get(name)).not.toBeNull();
    }
  });
});

test('a refusal carries the retry window the guard set', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/ping');
    const refused = await request(probe, '/ping');

    // The official suite asserts `retry-after` on the refusal and
    // the `x-ratelimit-*` trio on the allowed answers, because the
    // guard throws before it writes the trio: a refusal carrying
    // them is not something its own tests promise.
    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const retryAfter = refused.headers.get('retry-after');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

test('requests up to the limit are all answered', async () => {
  await withProbe(async (probe) => {
    const answers = await Promise.all(
      Array.from({ length: LIMIT }, () =>
        request(probe, '/ping'),
      ),
    );

    expect(
      answers.map((answered) => answered.status),
    ).toStrictEqual(
      Array.from({ length: LIMIT }, () => HttpStatus.OK),
    );
  });
});

test('the request past the limit is refused by the guard', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/ping');

    const refused = await request(probe, '/ping');

    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});

test('a refusal carries the body the package wrote, not the route s', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/once');

    const refused = await request(probe, '/once');

    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(refused.body).toStrictEqual({
      message: 'ThrottlerException: Too Many Requests',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});

test('the guard answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ThrottledModule,
  });
  try {
    const response = await request(probe, '/ping');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify(ALLOWED));
  } finally {
    await probe.close();
  }
});
