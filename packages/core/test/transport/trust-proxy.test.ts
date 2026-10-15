import { expect, test } from 'bun:test';

import { request } from '#test/probe';

import { FORWARDED_HOST, forwarded } from './helpers.ts';
import { startProbe } from '#adapter-test/support/index';

test('forwarded headers are ignored unless a proxy is trusted', async () => {
  const direct = await startProbe();
  try {
    const response = await request(direct, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({
      ips: [],
      protocol: 'http',
      secure: false,
    });
  } finally {
    await direct.close();
  }

  const proxied = await startProbe({
    adapter: { trustProxy: true },
  });
  try {
    const response = await request(proxied, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toStrictEqual({
      hostname: FORWARDED_HOST,
      ip: '203.0.113.7',
      ips: ['203.0.113.7', '10.0.0.1'],
      protocol: 'https',
      secure: true,
    });
  } finally {
    await proxied.close();
  }
});

test('a hop count trusts that many addresses from the right', async () => {
  const one = await startProbe({ adapter: { trustProxy: 1 } });
  try {
    const response = await request(one, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '10.0.0.1' });
  } finally {
    await one.close();
  }

  const both = await startProbe({ adapter: { trustProxy: 2 } });
  try {
    const response = await request(both, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await both.close();
  }
});

test('a trust list is walked from the right, the socket included', async () => {
  const withoutSocket = await startProbe({
    adapter: { trustProxy: ['10.0.0.1'] },
  });
  try {
    const response = await request(withoutSocket, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '127.0.0.1' });
  } finally {
    await withoutSocket.close();
  }

  const chain = await startProbe({
    adapter: { trustProxy: ['127.0.0.1', '10.0.0.1'] },
  });
  try {
    const response = await request(chain, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await chain.close();
  }
});

// `app.set('trust proxy', …)` is what an Express app does at bootstrap, so the adapter honours it
// there rather than only through its own options.
test('an application may set the trust while bootstrapping', async () => {
  const probe = await startProbe({
    configure: (app) => {
      app.set('trust proxy', ['127.0.0.1', '10.0.0.1']);
    },
  });
  try {
    const response = await request(probe, '/request', {
      headers: forwarded(),
    });
    expect(response.body).toMatchObject({
      ip: '203.0.113.7',
      protocol: 'https',
      secure: true,
    });
  } finally {
    await probe.close();
  }
});
