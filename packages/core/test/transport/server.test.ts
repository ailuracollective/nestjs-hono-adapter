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

test('security headers are only sent when asked for', async () => {
  const off = await startProbe();
  try {
    const response = await request(off, '/ping');
    expect(
      response.headers.get('x-content-type-options'),
    ).toBeNull();
  } finally {
    await off.close();
  }

  const sent = await startProbe({
    adapter: { secureHeaders: true },
  });
  try {
    const response = await request(sent, '/ping');
    expect(response.headers.get('x-content-type-options')).toBe(
      NOSNIFF,
    );
  } finally {
    await sent.close();
  }
});

test('a secureHeaders object is installed with its own options', async () => {
  const probe = await startProbe({
    adapter: { secureHeaders: { xFrameOptions: 'DENY' } },
  });
  try {
    const response = await request(probe, '/ping');
    expect(response.headers.get('x-frame-options')).toBe(
      'DENY',
    );
  } finally {
    await probe.close();
  }
});
