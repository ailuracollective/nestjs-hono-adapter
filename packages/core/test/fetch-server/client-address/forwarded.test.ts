import { expect, test } from 'bun:test';

import { ProbeModule } from '#adapter-test/support/index';
import { startFetch } from '#adapter-test/fetch-server/support';

test('trusted forwarded headers work without a host resolver', async () => {
  const probe = await startFetch(ProbeModule, {}, true);
  try {
    const response = await probe.fetch(
      new Request('http://host.test/request', {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1',
        },
      }),
    );
    expect(await response.json()).toMatchObject({
      ip: '198.51.100.1',
      ips: ['198.51.100.1'],
    });
  } finally {
    await probe.close();
  }
});
