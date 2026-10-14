import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';
import {
  jsonRequest,
  startProbe,
} from '#adapter-test/support/index';

test('a route answers with the value it returned', async () => {
  const probe = await startProbe({ mode: 'in-process' });
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
  const probe = await startProbe({ mode: 'in-process' });
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
  const probe = await startProbe({ mode: 'in-process' });
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
  const probe = await startProbe({ mode: 'in-process' });
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
  const probe = await startProbe({ mode: 'in-process' });
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
