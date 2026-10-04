import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import {
  jsonRequest,
  request,
  startAdapter,
  startProbe,
} from './probe.ts';

test('a route answers with the value it returned', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('application/json');
    expect(response.body).toStrictEqual({ pong: true });
  } finally {
    await probe.close();
  }
});

test('a primitive is answered as text', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/text');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/plain');
    expect(response.text).toBe('plain');
  } finally {
    await probe.close();
  }
});

test('a JSON body reaches the handler that asked for it', async () => {
  const probe = await startProbe();
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

test('a thrown HTTP exception is answered by Nest', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/boom');
    expect(response.status).toBe(HttpStatus.FORBIDDEN);
    expect(response.body).toMatchObject({
      message: 'nope',
      statusCode: HttpStatus.FORBIDDEN,
    });
  } finally {
    await probe.close();
  }
});

test('an unrouted path reaches the not-found handler', async () => {
  const probe = await startProbe();
  try {
    const response = await request(probe, '/nope');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
    });
  } finally {
    await probe.close();
  }
});

test('a QUERY request reaches the handler registered for it', async () => {
  const probe = await startProbe();
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
  const probe = await startProbe();
  try {
    const response = await request(probe, '/lookup');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a route registered on the adapter directly answers QUERY', async () => {
  const adapter = new ServerAdapter();
  adapter.query('/direct', (_request, response) => {
    response.res = Response.json({ direct: true });
  });
  const probe = await startAdapter(adapter);
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

test('the adapter reports itself to Nest', async () => {
  const probe = await startProbe();
  try {
    expect(probe.adapter.getType()).toBe('hono');
    expect(probe.adapter.isRouteOrderSensitive()).toBe(false);
    expect(probe.adapter.getHono()).toBeDefined();
  } finally {
    await probe.close();
  }
});
