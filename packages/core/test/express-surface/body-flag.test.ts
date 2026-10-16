import { Body, Controller, HttpStatus, Module, Post } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { jsonRequest, startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface Flagged {
  _body?: boolean | undefined;
  body?: unknown;
}

let flagged: Flagged = {};

class FlagMiddleware implements NestMiddleware {
  public use(source: Flagged, _response: unknown, next: () => void): void {
    // oxlint-disable-next-line eslint/no-underscore-dangle -- the flag `body-parser` reads.
    flagged = { _body: source._body, body: source.body };
    next();
  }
}

@Controller('flagged')
class FlagController {
  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }
}

@Module({ controllers: [FlagController] })
class FlagModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(FlagMiddleware).forRoutes('flagged');
  }
}

test('the adapter marks a parsed body so a body parser stands down', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: FlagModule });
  try {
    const response = await request(probe, '/flagged/echo', jsonRequest({ hello: 'world' }));
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toEqual({ hello: 'world' });
    // oxlint-disable-next-line eslint/no-underscore-dangle -- the flag `body-parser` reads.
    expect(flagged._body).toBe(true);
    expect(flagged.body).toEqual({ hello: 'world' });
  } finally {
    await probe.close();
  }
});
