import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

let seen = 0;

// `/api/ping` runs it once, the exact `/api` once more; a double run would make it three.
const HITS = 2;

class CountingMiddleware implements NestMiddleware {
  public use(_request: unknown, _response: unknown, next: () => void): void {
    seen += 1;
    next();
  }
}

@Controller()
class PrefixController {
  @Get('ping')
  public ping(): { readonly ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [PrefixController] })
class PrefixModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CountingMiddleware).forRoutes('*');
  }
}

// The core registers `/api$` next to `/api/*` to mark the exact prefix; the `$` must not reach Hono.
test('a wildcard middleware under a global prefix also runs for the exact prefix', async () => {
  seen = 0;
  const probe = await startAdapter(nodeAdapter(), {
    configure: (app) => {
      app.setGlobalPrefix('/api');
    },
    module: PrefixModule,
  });
  try {
    const ping = await request(probe, '/api/ping');
    expect(ping.status).toBe(HttpStatus.OK);
    expect(seen).toBe(1);
    const exact = await request(probe, '/api');
    expect(exact.status).toBe(HttpStatus.NOT_FOUND);
    expect(seen).toBe(HITS);
  } finally {
    await probe.close();
  }
});
