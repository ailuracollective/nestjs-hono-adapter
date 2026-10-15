import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestMiddleware, NestModule } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface HeaderResponse {
  getHeader: (name: string) => string | readonly string[] | undefined;
  setHeader: (name: string, value: string | readonly string[]) => void;
}

interface ReadBack {
  readonly cookies: string | readonly string[] | undefined;
  readonly removed: string | readonly string[] | undefined;
}

let read: ReadBack = { cookies: undefined, removed: undefined };

class HeaderMiddleware implements NestMiddleware {
  public use(_request: unknown, response: HeaderResponse, next: () => void): void {
    response.setHeader('x-single', 'first');
    response.setHeader('x-single', 'second');
    response.setHeader('x-list', ['a', 'b']);
    response.setHeader('x-list', ['c']);
    response.setHeader('x-gone', 'value');
    response.setHeader('x-gone', []);
    response.setHeader('set-cookie', ['one=1', 'two=2']);
    read = { cookies: response.getHeader('set-cookie'), removed: response.getHeader('x-gone') };
    next();
  }
}

@Controller()
class HeaderController {
  @Get('headers')
  public headers(): { readonly ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [HeaderController] })
class HeaderModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HeaderMiddleware).forRoutes('*');
  }
}

test('a setHeader array replaces the values, and an empty one removes the header', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: HeaderModule });
  try {
    const response = await request(probe, '/headers');
    expect(response.headers.get('x-single')).toBe('second');
    expect(response.headers.get('x-list')).toBe('c');
    expect(response.headers.get('x-gone')).toBeNull();
  } finally {
    await probe.close();
  }
});

test('getHeader answers set-cookie as a list, and a removed header as nothing', async () => {
  const probe = await startAdapter(nodeAdapter(), { module: HeaderModule });
  try {
    const response = await request(probe, '/headers');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.getSetCookie()).toStrictEqual(['one=1', 'two=2']);
    expect(read.cookies).toStrictEqual(['one=1', 'two=2']);
    expect(read.removed).toBeUndefined();
  } finally {
    await probe.close();
  }
});
