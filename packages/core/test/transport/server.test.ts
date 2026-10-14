import { expect, test } from 'bun:test';

import { BunServer, toBunTls } from '#adapter/servers/bun';
import { request } from '#test/probe';

import { NOSNIFF } from './helpers.ts';
import { startProbe } from '#adapter-test/support/index';

test('a plain server is the Bun server this adapter drives', async () => {
  const probe = await startProbe();
  try {
    expect(probe.adapter.getHttpServer()).toBeInstanceOf(
      BunServer,
    );
  } finally {
    await probe.close();
  }
});

test('httpsOptions are mapped onto Bun TLS options', () => {
  expect(
    toBunTls({ cert: 'the cert', key: 'the key' }),
  ).toStrictEqual({ cert: 'the cert', key: 'the key' });
});

test('security headers are sent unless they are turned off', async () => {
  const sent = await startProbe();
  try {
    const response = await request(sent, '/ping');
    expect(response.headers.get('x-content-type-options')).toBe(
      NOSNIFF,
    );
  } finally {
    await sent.close();
  }

  const off = await startProbe({
    adapter: { secureHeaders: false },
  });
  try {
    const response = await request(off, '/ping');
    expect(
      response.headers.get('x-content-type-options'),
    ).toBeNull();
  } finally {
    await off.close();
  }
});
