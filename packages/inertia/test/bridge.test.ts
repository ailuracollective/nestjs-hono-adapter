import { expect, test } from 'bun:test';
import { bridgeNames, ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { request } from '#test/probe';

import { OK, probeOf } from './support.ts';

test('the region finds the installed bridge package on its own', async () => {
  const probe = await probeOf();
  await probe.close();
  expect(bridgeNames()).toContain('inertia');
});

test('the bridge patches the adapter instance, not its prototype', async () => {
  const prototypeReply = Reflect.get(ServerAdapter.prototype, 'reply');
  const prototypeRedirect = Reflect.get(ServerAdapter.prototype, 'redirect');
  const probe = await probeOf();
  try {
    expect(Reflect.get(ServerAdapter.prototype, 'reply')).toBe(prototypeReply);
    expect(Reflect.get(ServerAdapter.prototype, 'redirect')).toBe(prototypeRedirect);
    expect(Reflect.get(probe.adapter, 'reply')).not.toBe(prototypeReply);
  } finally {
    await probe.close();
  }
});

test('a plain route is unaffected by the reply guard', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/plain');
    expect(response.status).toBe(OK);
    expect(response.body).toEqual({ ok: true });
  } finally {
    await probe.close();
  }
});
