import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface NodeResponse {
  header: (fields: Record<string, string>) => unknown;
  on: (event: string, listener: () => void) => unknown;
  req?: unknown;
}

interface LinkableRequest {
  res?: unknown;
}

let linked: { readonly held?: unknown; readonly same: boolean } = { same: false };

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

// Express links the pair when a nested router dispatches (`res.req = req`); Hono exposes `req` as a
// get-only accessor, so the write is kept beside that state rather than fought.
class LinkMiddleware implements NestMiddleware {
  public use(source: LinkableRequest, response: NodeResponse, next: () => void): void {
    response.req = source;
    source.res = response;
    linked = { held: response.req, same: response.req === source };
    next();
  }
}

@Module({ controllers: [MembersController] })
class LinkModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LinkMiddleware).forRoutes('*');
  }
}

test('a middleware that links res.req is honoured, not refused', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: LinkModule });
  try {
    const response = await request(probe, '/members');
    expect(response.status).toBe(HttpStatus.OK);
    expect(linked.same).toBe(true);
  } finally {
    await probe.close();
  }
});
