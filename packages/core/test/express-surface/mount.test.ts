import { Controller, Get, HttpStatus, Module, Req } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface Seen {
  baseUrl?: string | undefined;
  path?: string | undefined;
  url?: string | undefined;
}

const seen: Seen = {};

class MountMiddleware implements NestMiddleware {
  public use(source: Seen, _response: unknown, next: () => void): void {
    seen.baseUrl = source.baseUrl;
    seen.path = source.path;
    seen.url = source.url;
    next();
  }
}

@Controller('mounted')
class MountedController {
  @Get('hello')
  public hello(@Req() source: { url: string }): { url: string } {
    return { url: source.url };
  }
}

@Module({ controllers: [MountedController] })
class MountedModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MountMiddleware).forRoutes('mounted');
  }
}

test('a mounted middleware sees the url after the mount, and the route sees the whole one', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: MountedModule });
  try {
    const response = await request(probe, '/mounted/hello?q=1');
    expect(response.status).toBe(HttpStatus.OK);
    expect(seen.baseUrl).toBe('/mounted');
    expect(seen.path).toBe('/hello');
    expect(seen.url).toBe('/hello?q=1');
    expect(response.body).toEqual({ url: '/mounted/hello?q=1' });
  } finally {
    await probe.close();
  }
});
