import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import type { NestApplicationOptions } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';

import { securityHookOf } from './helpers.ts';
import { startAdapter, startProbe } from '#adapter-test/support/index';

test('a Hono route registered before listening is served', async () => {
  const adapter = bunAdapter();
  adapter.getHono().get('/native', (context) => context.text('native'));
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/native');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe('native');
  } finally {
    await probe.close();
  }
});

test('the security hook runs in front of every route', async () => {
  const adapter = bunAdapter();
  securityHookOf(adapter)((_request, response) => {
    response.setHeader('x-hook', 'ran');
  });
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('x-hook')).toBe('ran');
  } finally {
    await probe.close();
  }
});

test('a failure the security hook reports is answered by Nest', async () => {
  const adapter = bunAdapter();
  securityHookOf(adapter)(() => new Error('hook refused'));
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  } finally {
    await probe.close();
  }
});

type ClosingOptions = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

test('closing an adapter that never listened is not an error', async () => {
  const adapter = bunAdapter();
  const options: ClosingOptions = {
    forceCloseConnections: true,
    return503OnClosing: true,
  };
  adapter.initHttpServer(options);
  await adapter.close();
});

test('closing a running adapter twice is not an error', async () => {
  const probe = await startProbe();
  await probe.close();
  await probe.adapter.close();
});
