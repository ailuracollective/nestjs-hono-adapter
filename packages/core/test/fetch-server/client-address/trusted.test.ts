import { expect, test } from 'bun:test';

import { ProbeModule } from '#adapter-test/support/index';
import { startFetch } from '#adapter-test/fetch-server/support';

test('a trusted host address takes precedence over untrusted headers', async () => {
  const probe = await startFetch(ProbeModule, {
    clientAddress: () => '192.0.2.1',
  });
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
      ip: '192.0.2.1',
      ips: [],
    });
  } finally {
    await probe.close();
  }
});

test.each([
  {
    headers: { 'cf-connecting-ip': '203.0.113.7' },
    ip: '203.0.113.7',
    ips: [],
    trust: false,
  },
  {
    headers: { 'x-forwarded-for': '198.51.100.1' },
    ip: undefined,
    ips: [],
    trust: false,
  },
  {
    headers: { 'x-forwarded-for': '198.51.100.1' },
    ip: '198.51.100.1',
    ips: ['198.51.100.1'],
    trust: true,
  },
  { headers: {}, ip: undefined, ips: [], trust: true },
  {
    headers: {
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '198.51.100.1',
    },
    ip: '198.51.100.1',
    ips: ['198.51.100.1'],
    trust: true,
  },
] satisfies readonly {
  headers: Record<string, string>;
  ip: string | undefined;
  ips: string[];
  trust: boolean;
}[])(
  'an opted-in header resolves with proxy policy: %j',
  async ({ headers, ip, ips, trust }) => {
    const probe = await startFetch(
      ProbeModule,
      {
        clientAddress: (request) =>
          request.headers.get('cf-connecting-ip') ?? undefined,
      },
      trust,
    );
    try {
      const response = await probe.fetch(
        new Request('http://host.test/request', { headers }),
      );
      const body: unknown = await response.json();
      if (ip === undefined) {
        expect(body).not.toHaveProperty('ip');
      } else {
        expect(body).toMatchObject({ ip });
      }
      expect(body).toMatchObject({ ips });
    } finally {
      await probe.close();
    }
  },
);
