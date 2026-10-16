import { Server as HttpServer } from 'node:http';

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '#adapter/index';
import { request } from '#test/probe';
import { startAdapter } from '#adapter-test/support/index';
import { nodeAdapter } from './fixture.ts';

test('the Node transport serves a route', async () => {
  const probe = await startAdapter(nodeAdapter());
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
  } finally {
    await probe.close();
  }
});

test('the Node transport answers a JSON route', async () => {
  const probe = await startAdapter(nodeAdapter());
  try {
    const response = await request(probe, '/request');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('application/json');
  } finally {
    await probe.close();
  }
});

test("the Node transport answers Node's own server", async () => {
  const adapter = nodeAdapter();
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/ping');
    expect(response.status).toBe(HttpStatus.OK);
    const server = adapter.getHttpServer();
    expect(server).toBeInstanceOf(HttpServer);
    expect(typeof server.closeAllConnections).toBe('function');
    expect(server.address()).not.toBeNull();
  } finally {
    await probe.close();
  }
});

test('an undefined transport is answered by the default and keeps the other options', async () => {
  const options = {
    trustProxy: true,
  };
  Reflect.set(options, 'transport', undefined);
  const adapter = new ServerAdapter(options);
  const probe = await startAdapter(adapter);
  try {
    const response = await request(probe, '/request', {
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });
    expect(response.body).toMatchObject({ ip: '203.0.113.7' });
  } finally {
    await probe.close();
  }
});
