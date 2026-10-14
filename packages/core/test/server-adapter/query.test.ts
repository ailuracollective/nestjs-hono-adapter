import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';
import {
  startAdapter,
  startProbe,
} from '#adapter-test/support/index';

test('a QUERY request reaches the handler registered for it', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    const response = await request(probe, '/lookup', {
      method: 'QUERY',
    });
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ method: 'QUERY' });
  } finally {
    await probe.close();
  }
});

test('a QUERY route is only answered for that method', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    const response = await request(probe, '/lookup');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a route registered on the adapter directly answers QUERY', async () => {
  const adapter = bunAdapter();
  adapter.query('/direct', (_request, response) => {
    response.res = Response.json({ direct: true });
  });
  const probe = await startAdapter(adapter, {
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/direct', {
      method: 'QUERY',
    });
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ direct: true });
  } finally {
    await probe.close();
  }
});
