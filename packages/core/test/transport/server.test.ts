import { expect, test } from 'bun:test';

import { BunServer, toBunTls } from '#adapter/servers/bun';
import { tlsOf } from '#adapter/servers/bun-runtime';
import { request } from '#test/probe';

import { NOSNIFF } from './helpers.ts';
import { startProbe } from '#adapter-test/support/index';

test('a plain server is the Bun server this adapter drives', async () => {
  const probe = await startProbe();
  try {
    expect(probe.adapter.getHttpServer()).toBeInstanceOf(BunServer);
  } finally {
    await probe.close();
  }
});

test('httpsOptions are mapped onto the fields Bun reads', () => {
  expect(toBunTls({ cert: 'the cert', key: 'the key' })).toStrictEqual({
    cert: 'the cert',
    key: 'the key',
  });
  // `pfx` is a Nest option Bun has no counterpart for, so it must not reach the server.
  expect(toBunTls({ cert: 'the cert', pfx: 'the pfx' })).toStrictEqual({ cert: 'the cert' });
});

test('a certificate Bun cannot use is refused, not served in the clear', () => {
  expect(tlsOf()).toBeUndefined();
  expect(tlsOf({ cert: 'the cert', key: 'the key' })).toStrictEqual({
    cert: 'the cert',
    key: 'the key',
  });
  expect(() => tlsOf({ pfx: 'the pfx' })).toThrow(/key and a cert/u);
  expect(() => tlsOf({})).toThrow(/key and a cert/u);
});

test('security headers are only sent when asked for', async () => {
  const off = await startProbe();
  try {
    const response = await request(off, '/ping');
    expect(response.headers.get('x-content-type-options')).toBeNull();
  } finally {
    await off.close();
  }

  const sent = await startProbe({
    adapter: { secureHeaders: true },
  });
  try {
    const response = await request(sent, '/ping');
    expect(response.headers.get('x-content-type-options')).toBe(NOSNIFF);
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
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  } finally {
    await probe.close();
  }
});
