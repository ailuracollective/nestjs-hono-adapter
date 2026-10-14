import { expect, test } from 'bun:test';

import { request } from '#test/probe';

import { ENGINE, FIXTURES } from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';

test('locals survive default context configuration and later renders', async () => {
  const defaults = Object.freeze({
    extra: 'first',
    name: 'default',
    title: 'default',
  });
  const probe = await startProbe({
    adapter: {
      views: {
        directory: FIXTURES,
        engine: (_source, data) => JSON.stringify(data),
      },
    },
    configure: (app) => {
      app.setLocal('title', 'local');
      app.setLocal('before', 'kept');
      app.setViewEngine({
        defaultContext: defaults,
        viewExt: ENGINE,
      });
      app.setLocal('after', 'added');
    },
    mode: 'in-process',
  });
  try {
    const first = await request(probe, '/view');
    expect(JSON.parse(first.text)).toStrictEqual({
      after: 'added',
      before: 'kept',
      extra: 'first',
      name: 'Nest',
      title: 'local',
    });
    probe.app.setViewEngine({
      defaultContext: { extra: 'second', name: 'new default' },
    });
    probe.app.setLocal('title', 'updated');
    const second = await request(probe, '/view');
    expect(JSON.parse(second.text)).toStrictEqual({
      after: 'added',
      before: 'kept',
      extra: 'second',
      name: 'Nest',
      title: 'updated',
    });
  } finally {
    await probe.close();
  }
});
