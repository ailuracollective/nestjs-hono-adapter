import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';
import type { Probe } from '#test/probe';

import { CqrsModuleFixture, GreetedListener } from './fixture.ts';
import { ANSWER, GREETING } from './messages.ts';

const COMMAND_REQUEST = {
  body: JSON.stringify({ name: 'nest' }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
};

const withProbe = async <Answer>(read: (probe: Probe) => Promise<Answer>): Promise<Answer> => {
  GreetedListener.seen.length = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: CqrsModuleFixture,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

test('a route answers through a command the bus executed', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/greet', COMMAND_REQUEST);

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ greeting: GREETING });
  });
});

test('a route answers with what a query handler answered', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/double');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(ANSWER);
  });
});

test('an event published by a command reaches a listener', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/greet', COMMAND_REQUEST);

    expect(GreetedListener.seen).toStrictEqual(['nest']);
  });
});

test('an event published by a route reaches a listener', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/publish');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ published: 'yes' });
    expect(GreetedListener.seen).toStrictEqual(['nest']);
  });
});

test('the buses answer over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: CqrsModuleFixture,
  });
  try {
    const response = await request(probe, '/double');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify(ANSWER));
  } finally {
    await probe.close();
  }
});
