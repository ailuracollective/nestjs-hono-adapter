import { Readable } from 'node:stream';
import type { Writable } from 'node:stream';
import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface RawResponse {
  emit: (event: string, ...args: unknown[]) => boolean;
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

class PipeMiddleware implements NestMiddleware {
  public use(_request: unknown, response: RawResponse, _next: () => void): void {
    response.setHeader('content-type', 'text/plain');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the proxy supplies the stream's write/end/emit members.
    Readable.from(['node ', 'stream']).pipe(response as unknown as Writable);
  }
}

@Module({ controllers: [EchoController] })
class PipeModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PipeMiddleware).forRoutes('*');
  }
}

test('a middleware can pipe a stream into the response', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: PipeModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('node stream');
  } finally {
    await probe.close();
  }
});

class EndOverrideMiddleware implements NestMiddleware {
  public use(_request: unknown, response: RawResponse, _next: () => void): void {
    response.setHeader('content-type', 'text/plain');
    const original: (body?: unknown) => void = response.end;
    response.end = (body?: unknown): void => {
      original(`wrapped ${String(body)}`);
    };
    response.end('body');
  }
}

@Module({ controllers: [EchoController] })
class EndOverrideModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(EndOverrideMiddleware).forRoutes('*');
  }
}

// A middleware may wrap `end` (compression does) and expect the next layer to use the wrapper.
class WrapEndMiddleware implements NestMiddleware {
  public use(_request: unknown, response: RawResponse, next: () => void): void {
    const original: (body?: unknown) => void = response.end;
    response.end = (body?: unknown): void => {
      original(`wrapped ${String(body)}`);
    };
    next();
  }
}

@Module({ controllers: [EchoController] })
class WrapEndModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(WrapEndMiddleware, EndOverrideMiddleware).forRoutes('*');
  }
}

test('a middleware can replace the surface end', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: EndOverrideModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.text).toBe('wrapped body');
  } finally {
    await probe.close();
  }
});

test('an end wrapper is visible to the next middleware', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: WrapEndModule });
  try {
    const response = await request(probe, '/echo');
    expect(response.text).toBe('wrapped wrapped body');
  } finally {
    await probe.close();
  }
});

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
