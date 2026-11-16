import { afterEach, expect, test } from 'bun:test';

import { registerBridge, resetBridges } from '#adapter/compat/index';
import type { Bridge } from '#adapter/compat/index';
import { ResponseModule } from '#adapter-test/response-fixture';
import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';
import type { Probe } from '#test/probe';

import { FAKE, fakeBridge } from './fixture.ts';

const FITTED = 'fitted';

// The first consumer's shape: the two answer members replaced on one instance, nothing else.
const stamping: Bridge = {
  install: ({ adapter }) => {
    const reply = adapter.reply.bind(adapter);
    const redirect = adapter.redirect.bind(adapter);
    adapter.reply = (response, body, statusCode): void => {
      response.header('x-bridge', FITTED);
      reply(response, body, statusCode);
    };
    adapter.redirect = (response, statusCode, url): void => {
      response.header('x-bridge', FITTED);
      redirect(response, statusCode, url);
    };
  },
  name: 'stamping',
};

/** An application started before the bridge is registered, and one started after it. */
const startPair = async (): Promise<{ readonly fitted: Probe; readonly plain: Probe }> => {
  resetBridges();
  const plain = await startProbe({ mode: 'in-process', module: ResponseModule });
  registerBridge(stamping);
  const fitted = await startProbe({ mode: 'in-process', module: ResponseModule });
  return { fitted, plain };
};

afterEach(() => {
  resetBridges();
});

test('a bridge is handed the adapter that serves the application', async () => {
  resetBridges();
  const bridge = fakeBridge(FAKE);
  registerBridge(bridge);
  const probe = await startProbe({ mode: 'in-process', module: ResponseModule });
  try {
    const [seen] = bridge.seen;
    if (seen === undefined) throw new Error('the bridge was handed nothing');
    expect(seen.adapter).toBe(probe.adapter);
  } finally {
    await probe.close();
  }
});

test('a bridge fits reply on that application, and the prototype is left alone', async () => {
  const { fitted, plain } = await startPair();
  try {
    const answered = await request(fitted, '/response/decorated');
    expect(answered.headers.get('x-bridge')).toBe(FITTED);

    const stock = await request(plain, '/response/decorated');
    expect(stock.headers.get('x-bridge')).toBeNull();
  } finally {
    await fitted.close();
    await plain.close();
  }
});

test('a bridge fits redirect on that application, and the prototype is left alone', async () => {
  const { fitted, plain } = await startPair();
  try {
    const redirected = await request(fitted, '/response/redirect', { redirect: 'manual' });
    expect(redirected.headers.get('x-bridge')).toBe(FITTED);
    expect(redirected.headers.get('location')).toBe('https://example.com/');

    const stock = await request(plain, '/response/redirect', { redirect: 'manual' });
    expect(stock.headers.get('x-bridge')).toBeNull();
  } finally {
    await fitted.close();
    await plain.close();
  }
});
