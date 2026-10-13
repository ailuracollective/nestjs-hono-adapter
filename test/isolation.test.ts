/**
 * The suite runs every file in one process, so a file that
 * starts an application on the default transport must not
 * decide what an application beside it answers. Issue #120.
 *
 * `new ServerAdapter()` picks the Node transport with
 * `overrideGlobalObjects` on, which is the behaviour every
 * deployment had before the transports split:
 * `@hono/node-server` replaces the process's `Request` and
 * `Response` with its lighter classes and never puts them back.
 * A Bun server beside it then builds its answer from the
 * lightweight `Response`, which `Bun.serve` refuses with the
 * `"Welcome to Bun!"` body -- the answer the reported failures
 * saw. The probe puts the process's own classes back before it
 * asks, which is what makes the files independent.
 *
 * The two applications are started one after the other, which
 * is all this case needs: the replacement is permanent, so a
 * neighbour started before the first one is answered the same
 * way.
 */

import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '../src/index.ts';
import { bunAdapter } from './bun-adapter.ts';
import { request } from './probe.ts';
import { startAdapter } from './support.ts';

/** Proves a Bun application still answers a route of its own. */
async function answersBeside(): Promise<void> {
  const probe = await startAdapter(bunAdapter());
  try {
    const answer = await request(probe, '/ping');
    expect(answer.status).toBe(HttpStatus.OK);
    expect(answer.body).toStrictEqual({ pong: true });
  } finally {
    await probe.close();
  }
}

test('an application on the default transport leaves a Bun one alone', async () => {
  const defaulted = await startAdapter(new ServerAdapter());
  try {
    const own = await request(defaulted, '/ping');
    expect(own.status).toBe(HttpStatus.OK);
    await answersBeside();
  } finally {
    await defaulted.close();
  }
});
