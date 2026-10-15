import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface ExpressResponse {
  set?: unknown;
  setHeader?: (name: string, value: string | readonly string[]) => void;
  writeHead?: (status?: number, ...rest: unknown[]) => unknown;
}

// `cookie-session` writes its cookie from an `on-headers` listener patching `writeHead`, so the
// bridge must call the patched `writeHead` once the chain settles and must not expose `set`.
class CookieMiddleware implements NestMiddleware {
  public use(_request: unknown, response: ExpressResponse, next: () => void): void {
    const head = response.writeHead === undefined ? undefined : response.writeHead.bind(response);
    response.writeHead = (status?: number, ...rest: unknown[]): unknown => {
      if (response.setHeader !== undefined) response.setHeader('set-cookie', ['probe=1; path=/']);
      if (head === undefined) return undefined;
      return head(status, ...rest);
    };
    next();
  }
}

@Controller()
class EchoController {
  @Get('echo')
  public echo(): { readonly ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [EchoController] })
class CookieModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CookieMiddleware).forRoutes('*');
  }
}

test('a middleware that writes a cookie from writeHead reaches the response', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: CookieModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('set-cookie')).toContain('probe=1');
  } finally {
    await probe.close();
  }
});
