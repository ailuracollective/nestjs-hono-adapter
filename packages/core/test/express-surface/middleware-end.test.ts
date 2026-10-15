import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface RawResponse {
  end: (body?: unknown) => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
  write: (chunk: unknown) => boolean;
}

// A Node-style middleware answers with `write`/`end` and never calls `next` (the way tRPC's Express
// adapter does), so the body it leaves is what settles the response.
class RawMiddleware implements NestMiddleware {
  public use(_request: unknown, response: RawResponse, _next: () => void): void {
    response.setHeader('content-type', 'text/plain');
    response.statusCode = HttpStatus.CREATED;
    response.write('node ');
    response.end('style');
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
class RawModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RawMiddleware).forRoutes('*');
  }
}

test('a middleware that answers with write/end settles the response', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: RawModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.contentType).toBe('text/plain');
    expect(response.text).toBe('node style');
  } finally {
    await probe.close();
  }
});

// Node ignores a write after `end` and errors on a second `end`; the proxy must not settle the
// response a second time either.
class TwiceMiddleware implements NestMiddleware {
  public use(_request: unknown, response: RawResponse, _next: () => void): void {
    response.setHeader('content-type', 'text/plain');
    response.write('first');
    response.end(' body');
    response.write(' ignored');
    response.end(' ignored');
  }
}

@Module({ controllers: [EchoController] })
class TwiceModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TwiceMiddleware).forRoutes('*');
  }
}

test('a second end, and a write after it, are ignored', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: TwiceModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('first body');
  } finally {
    await probe.close();
  }
});
