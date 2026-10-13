/**
 * The suite runs every file in one process, so an application
 * started on a Node transport with the global override on must
 * not decide what an application beside it answers. Issue
 * #120.
 *
 * The case names `nodeServer({ overrideGlobalObjects: true })`
 * itself: `@hono/node-server` replaces the process's `Request`
 * and `Response` with its lighter classes and never puts them
 * back. A Bun server beside it then builds its answer from the
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
import { nodeServer } from '../src/servers/node.ts';
import { bunAdapter } from '../../../test/bun-adapter.ts';
import { request } from '../../../test/probe.ts';
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

test('a Node transport with the global override on leaves a Bun application alone', async () => {
  const overridden = await startAdapter(
    new ServerAdapter({
      transport: nodeServer({ overrideGlobalObjects: true }),
    }),
  );
  try {
    const own = await request(overridden, '/ping');
    expect(own.status).toBe(HttpStatus.OK);
    await answersBeside();
  } finally {
    await overridden.close();
  }
});
