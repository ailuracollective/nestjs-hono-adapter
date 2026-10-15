import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface NodeResponse {
  header: (fields: Record<string, string>) => unknown;
  on: (event: string, listener: () => void) => unknown;
}

// `compression` listens on the response before it decides to compress, and an exception filter sets
// its headers as an object through `res.header` — Express's alias of `res.set`.
class MembersMiddleware implements NestMiddleware {
  public use(_request: unknown, response: NodeResponse, next: () => void): void {
    // oxlint-disable-next-line eslint/no-empty-function -- the listener exists to be accepted; `compression` frees its zlib handle from one.
    response.on('close', () => {});
    response.header({ 'x-from-middleware': 'yes' });
    next();
  }
}

@Controller()
class MembersController {
  @Get('members')
  public members(): { readonly ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [MembersController] })
class MembersModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MembersMiddleware).forRoutes('*');
  }
}

test('a middleware may listen on the response and set headers as an object', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: MembersModule });
  try {
    const response = await request(probe, '/members');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('x-from-middleware')).toBe('yes');
  } finally {
    await probe.close();
  }
});
