import { Body, Controller, Get, HttpStatus, Module } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { startAdapter } from '#adapter-test/support/index';
import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';

@Controller()
class GetBodyController {
  @Get('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }
}

@Module({ controllers: [GetBodyController] })
class GetBodyModule {}

// Nest reads a body on any method, and Bun serves one, so GET must not be special-cased.
test('a GET body reaches the handler', async () => {
  const probe = await startAdapter(bunAdapter(), {
    mode: 'in-process',
    module: GetBodyModule,
  });
  try {
    const response = await request(probe, '/echo', {
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'content-type': 'application/json' },
      method: 'GET',
    });
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ hello: 'world' });
  } finally {
    await probe.close();
  }
});
