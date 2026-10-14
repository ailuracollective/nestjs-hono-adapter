import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import {
  jsonRequest,
  startAdapter,
  startProbe,
} from '#adapter-test/support/index';
import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';

test('a JSON body reaches the handler that asked for it', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(
      probe,
      '/echo',
      jsonRequest({ hello: 'world' }),
    );
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ hello: 'world' });
  } finally {
    await probe.close();
  }
});

test.each(['arrayBuffer', 'text'] as const)(
  'a body read with %s by Hono middleware reaches the controller',
  async (read) => {
    const adapter = bunAdapter();
    adapter.getHono().use('*', async (context, next) => {
      await context.req[read]();
      return next();
    });
    const probe = await startAdapter(adapter, {
      mode: 'in-process',
    });
    try {
      const response = await request(
        probe,
        '/echo',
        jsonRequest({ hello: 'world' }),
      );
      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toStrictEqual({ hello: 'world' });
    } finally {
      await probe.close();
    }
  },
);

test('a JSON suffix type is read as JSON', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: JSON.stringify({ data: 'value' }),
      headers: { 'content-type': 'application/vnd.api+json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ data: 'value' });
  } finally {
    await probe.close();
  }
});

test('an empty JSON body is read as an empty object', async () => {
  const probe = await startProbe({
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/echo', {
      body: '',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({});
  } finally {
    await probe.close();
  }
});
