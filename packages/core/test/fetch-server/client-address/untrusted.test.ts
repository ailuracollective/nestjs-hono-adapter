import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ProbeModule } from '#adapter-test/support/index';
import { startFetch } from '#adapter-test/fetch-server/support';

test('untrusted fetch headers cannot supply the client address', async () => {
  const probe = await startFetch(ProbeModule);
  try {
    const response = await probe.fetch(
      new Request('http://host.test/request', {
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
        },
      }),
    );
    expect(response.status).toBe(HttpStatus.OK);
    const body: unknown = await response.json();
    expect(body).not.toHaveProperty('ip');
    expect(body).toMatchObject({ ips: [] });
  } finally {
    await probe.close();
  }
});
