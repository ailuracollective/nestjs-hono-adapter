import { expect, test } from 'bun:test';

import { HttpStatus, ValidationPipe } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

import { ValidationModule } from './fixture.ts';

/** The pipe every case runs the body through. */
const pipe = (): ValidationPipe =>
  new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    whitelist: true,
  });

/** Starts a probe with the pipe installed. */
const withPipe = (): ReturnType<typeof startProbe> =>
  startProbe({
    configure: (app) => {
      app.useGlobalPipes(pipe());
    },
    mode: 'in-process',
    module: ValidationModule,
  });

test('a valid body reaches the handler', async () => {
  const probe = await withPipe();
  try {
    const response = await request(probe, '/validated', {
      body: JSON.stringify({ age: 3, name: 'Ada' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      age: 3,
      name: 'Ada',
    });
  } finally {
    await probe.close();
  }
});

test('the pipe transforms the body before the handler reads it', async () => {
  const probe = await withPipe();
  try {
    const response = await request(probe, '/validated', {
      body: JSON.stringify({ age: '3', name: 'Ada' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({
      age: 3,
      name: 'Ada',
    });
  } finally {
    await probe.close();
  }
});

test('an invalid body is refused by the pipe', async () => {
  const probe = await withPipe();
  try {
    const response = await request(probe, '/validated', {
      body: JSON.stringify({ age: 0, name: 5 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  } finally {
    await probe.close();
  }
});
