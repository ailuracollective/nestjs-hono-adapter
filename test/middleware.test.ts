import { expect, test } from 'bun:test';
import type { Type } from '@nestjs/common';

import type { NestContext } from '../src/index.ts';
import {
  GlobalMiddlewareModule,
  MethodMiddlewareModule,
  MIDDLEWARE_HEADER,
  MIDDLEWARE_MARK,
  PrefixedMiddlewareModule,
} from './middleware-fixture.ts';
import type { Probe } from './probe.ts';
import { startProbe } from './support.ts';

/**
 * Middleware mounting, which the router decides rather than the
 * handler. A piece of Nest middleware is mounted through the
 * adapter's middleware factory, and the platform adapters read
 * a path without a method as a prefix: it answers the path and
 * everything under it. Nothing here needs a socket, so every
 * case runs in process.
 */

/** What the marker left on an answer, or nothing at all. */
function markOf(response: Response): string | null {
  return response.headers.get(MIDDLEWARE_HEADER);
}

/** An application on a module, answered in process. */
function middlewareProbe(
  module: Type<unknown>,
): Promise<Probe> {
  return startProbe({ mode: 'in-process', module });
}

/** A JSON body the POST route echoes back. */
const SENT = { sent: true };

test('middleware for every route answers every route', async () => {
  const probe = await middlewareProbe(GlobalMiddlewareModule);
  try {
    expect(markOf(await probe.respond('/ping'))).toBe(
      MIDDLEWARE_MARK,
    );
    expect(markOf(await probe.respond('/api/ping'))).toBe(
      MIDDLEWARE_MARK,
    );
  } finally {
    await probe.close();
  }
});

/**
 * The adapter's own `use()` is the same mount without a
 * `MiddlewareConsumer`: a handler and nothing else answers
 * every path, which is what `router.use()` reads on both
 * platform adapters. Mounted at the root path instead, this
 * would answer `/` alone and leave every other route unmarked.
 */
test('a handler mounted with use() answers every route', async () => {
  const probe = await startProbe({
    configure: (app): void => {
      app
        .getHttpAdapter()
        .use(
          (
            _request: unknown,
            response: NestContext,
            next: () => void,
          ): void => {
            response.header(MIDDLEWARE_HEADER, MIDDLEWARE_MARK);
            next();
          },
        );
    },
    mode: 'in-process',
  });
  try {
    expect(markOf(await probe.respond('/ping'))).toBe(
      MIDDLEWARE_MARK,
    );
    expect(markOf(await probe.respond('/text'))).toBe(
      MIDDLEWARE_MARK,
    );
  } finally {
    await probe.close();
  }
});

test('middleware for a prefix answers the prefix and what lies under it', async () => {
  const probe = await middlewareProbe(PrefixedMiddlewareModule);
  try {
    expect(markOf(await probe.respond('/api/ping'))).toBe(
      MIDDLEWARE_MARK,
    );
    expect(markOf(await probe.respond('/ping'))).toBeNull();
  } finally {
    await probe.close();
  }
});

test('middleware for one method answers that method alone', async () => {
  const probe = await middlewareProbe(MethodMiddlewareModule);
  try {
    const posted = await probe.respond('/api/ping', {
      body: JSON.stringify(SENT),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(markOf(posted)).toBe(MIDDLEWARE_MARK);
    expect(markOf(await probe.respond('/api/ping'))).toBeNull();
  } finally {
    await probe.close();
  }
});
