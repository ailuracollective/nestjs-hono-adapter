import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';
import { HOST, HOSTED_PATH, HostModule, SUBDOMAIN_PATH } from '#adapter-test/host-fixture';
import { startProbe } from '#adapter-test/support/index';

const onHost = (host: string): RequestInit => ({
  headers: { host },
});

test('a controller declaring a host answers the host it names', async () => {
  const probe = await startProbe({ module: HostModule });
  try {
    const response = await request(probe, HOSTED_PATH, onHost(HOST));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ host: true });
  } finally {
    await probe.close();
  }
});

test('a controller declaring a host leaves another host unanswered', async () => {
  const probe = await startProbe({ module: HostModule });
  try {
    const response = await request(probe, HOSTED_PATH, onHost('other.example.com'));
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('@HostParam() reads the subdomain the host carried', async () => {
  const probe = await startProbe({ module: HostModule });
  try {
    const response = await request(probe, SUBDOMAIN_PATH, onHost('bob.example.com'));
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ sub: 'bob' });
  } finally {
    await probe.close();
  }
});
