import { Controller, Get, HttpStatus, Module } from '@nestjs/common';
import { expect, test } from 'bun:test';

import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from '#adapter-test/node-server/fixture';

interface ErrorResponse {
  cookie?: unknown;
  end?: unknown;
  json: (body: unknown) => unknown;
  on?: unknown;
  setHeader?: unknown;
  status: (code: number) => ErrorResponse;
  write?: unknown;
}

const seen: {
  dialect?: readonly string[];
  err?: unknown;
  originalUrl?: unknown;
  statusOf?: unknown;
} = {};

// Express's error middleware declares four parameters. Nest's own middleware path wraps a module
// middleware down to three, so the shape only survives `app.use(...)`; the adapter recognises the
// declared arity where Nest mounts it, rather than patching Hono's own `use`.
// oxlint-disable-next-line eslint/max-params -- the four parameters are the Express signature under test.
const errorMiddleware = (
  err: unknown,
  source: { originalUrl?: unknown },
  response: ErrorResponse,
  _next: () => void,
): void => {
  seen.dialect = [
    response.cookie,
    response.end,
    response.on,
    response.setHeader,
    response.write,
  ].map((member) => typeof member);
  seen.err = err;
  seen.originalUrl = source.originalUrl;
  seen.statusOf = typeof response.status;
  response.status(HttpStatus.I_AM_A_TEAPOT).json({ from: 'error-middleware' });
};

@Controller()
class EchoController {
  @Get('echo')
  public echo(): { readonly ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

test('a four-argument middleware mounted on the application is handed the Express shape', async () => {
  const probe = await startAdapter(nodeAdapter(), {
    configure: (app) => {
      app.use(errorMiddleware);
    },
    module: EchoModule,
  });
  try {
    const response = await request(probe, '/echo');
    expect(response.status).toBe(HttpStatus.I_AM_A_TEAPOT);
    expect(response.body).toEqual({ from: 'error-middleware' });
    expect(seen.err).toBeUndefined();
    expect(seen.statusOf).toBe('function');
    // The four-argument path is handed the same middleware view as any other, not a second dialect.
    expect(seen.dialect).toStrictEqual([
      'function',
      'function',
      'function',
      'function',
      'function',
    ]);
    expect(String(seen.originalUrl)).toMatch(/\/echo$/u);
  } finally {
    await probe.close();
  }
});
