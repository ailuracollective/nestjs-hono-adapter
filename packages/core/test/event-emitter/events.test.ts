import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { EVENT, OrderModule, received } from './fixture.ts';
import { ORDER_REQUEST, withProbe } from './support.ts';

test('a route answers after emitting an event', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/order', ORDER_REQUEST);

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ emitted: EVENT });
  });
});

test('the event a route emitted reached a listener', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      handled: ['placed'],
    });
  });
});

test('an event with no listener named still leaves the route answered', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/order', ORDER_REQUEST);

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.text).toBe(JSON.stringify({ emitted: EVENT }));
  });
});

test('a listener sees every emission, in order', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/order', ORDER_REQUEST);
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.body).toStrictEqual({
      handled: ['placed', 'placed'],
    });
  });
});

test('the emitter and its listeners answer over a real connection', async () => {
  received.length = 0;
  const probe = await startProbe({
    mode: 'socket',
    module: OrderModule,
  });
  try {
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify({ handled: ['placed'] }));
  } finally {
    await probe.close();
  }
});
