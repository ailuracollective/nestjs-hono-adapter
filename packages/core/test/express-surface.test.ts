import 'reflect-metadata';

import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { describe, expect, it } from 'bun:test';

import { request, startProbe } from '../../../test/probe.ts';
import type { Probe } from '../../../test/probe.ts';

/**
 * The Express surface, which is what a module that registers a
 * route on the adapter itself writes through: `res.type()` and
 * `res.send()`, with the Hono context handed over as `res`.
 *
 * The case that matters is the type a string goes out as.
 * Express reads `res.send(html)` as `text/html`, and that is
 * the reading the surface reproduces — `@nestjs/swagger`
 * depends on it, and so does `@scalar/nestjs-api-reference`,
 * whose middleware hands over a whole page and nothing else.
 * The answer a Nest _handler_ returns is a different path and
 * keeps the Fastify reading `docs/platform-differences.md`
 * records, which the last case here holds.
 */

/** A page the surface is asked to send, and the text it holds. */
const PAGE = '<!doctype html><title>page</title>';

@Controller()
class PageController {
  @Get('text')
  public text(): string {
    return 'plain';
  }
}

@Module({ controllers: [PageController] })
class PageModule {}

/** The answer every case here expects of a page. */
const SERVED = HttpStatus.OK;

/**
 * The surface as a module that registers a route on the adapter
 * receives it: the Hono context, carrying only what the adapter
 * installed on it.
 */
interface ExpressResponse {
  send: (body: unknown) => void;
  type: (value: string) => void;
}

/**
 * Says of a context whether it carries the surface, which is
 * the same check `installExpressSurface()` makes before it
 * installs it.
 */
function hasSurface(value: unknown): value is ExpressResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, 'send') === 'function' &&
    typeof Reflect.get(value, 'type') === 'function'
  );
}

/** Reads the surface off what the adapter handed the handler. */
function surfaceOf(response: unknown): ExpressResponse {
  if (!hasSurface(response)) {
    throw new TypeError(
      'the context carries no express surface',
    );
  }
  return response;
}

/** Mounts one middleware at `/reference` and answers it. */
async function withSurface(
  handler: (response: ExpressResponse) => void,
  run: (probe: Probe) => Promise<void>,
): Promise<void> {
  const probe = await startProbe({
    configure: (app) => {
      app.use(
        '/reference',
        (_request: unknown, response: unknown) => {
          handler(surfaceOf(response));
        },
      );
    },
    mode: 'in-process',
    module: PageModule,
  });
  try {
    await run(probe);
  } finally {
    await probe.close();
  }
}

describe('what res.send() answers', () => {
  it('a string sent as a document as HTML', async () => {
    await withSurface(
      (response) => {
        response.send(PAGE);
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe(
          'text/html; charset=UTF-8',
        );
        expect(result.text).toContain('<title>page</title>');
      },
    );
  });

  it('leaves a type the caller declared alone', async () => {
    await withSurface(
      (response) => {
        response.type('text/plain');
        response.send(PAGE);
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe('text/plain');
      },
    );
  });

  it('leaves an object sent as JSON alone', async () => {
    await withSurface(
      (response) => {
        response.send({ sent: true });
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toContain(
          'application/json',
        );
        expect(result.body).toEqual({ sent: true });
      },
    );
  });
});

describe('what the adapter leaves alone', () => {
  it('does not change what a handler returns', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: PageModule,
    });
    try {
      const result = await request(probe, '/text');
      expect(result.status).toBe(SERVED);
      expect(result.contentType).toBe(
        'text/plain; charset=UTF-8',
      );
      expect(result.text).toBe('plain');
    } finally {
      await probe.close();
    }
  });
});
