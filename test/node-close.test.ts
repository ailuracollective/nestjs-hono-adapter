/**
 * The close path of the Node transport, and the callback a Node
 * caller passes to it. Issue #121.
 *
 * `adaptClose` replaces the native `server.close` with the
 * promise the port answers through. A caller that passed a
 * callback of its own had it tested and never invoked, so the
 * promise never settled for that caller -- and `close` is not
 * only ours to call. Nest's own `AbstractWsAdapter.close` waits
 * on exactly that callback:
 *
 * IsCallable && (await new Promise(resolve =>
 * server.close(resolve)));
 *
 * So a WebSocket application on this transport did not finish
 * `app.close()`. socket.io waits the same way, which is how the
 * socket.io island found this.
 *
 * The callback is what the bug was, so it is asserted directly,
 * with the boolean the Nest lifecycle passes asserted beside it
 * so the fix cannot have cost that path.
 *
 * The cases are self-contained on purpose: `bun test` runs the
 * files concurrently in one process.
 */

import { expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ServerAdapter } from '../packages/core/src/index.ts';
import { nodeServer } from '../packages/core/src/servers/node.ts';

/** The port the process picks, so no case reserves one. */
const ANY_PORT = 0;
/** Where the cases listen. */
const LOCALHOST = '127.0.0.1';
/** How long a close gets before it counts as hung. */
const BUDGET_MS = 2000;

/** The close the adapter replaced, which takes a callback. */
interface CallbackClose {
  readonly close: (
    answer: (error?: Error) => void,
  ) => Promise<void>;
}

/**
 * Nothing to serve: these cases are about the server's own
 * close.
 */
@Module({})
class QuietModule {}

/** True when the work completed successfully inside the budget. */
async function settled(
  work: Promise<unknown>,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined =
    undefined;
  try {
    return await Promise.race([
      work.then(() => true),
      // oxlint-disable-next-line promise/avoid-new -- the timeout is settled from outside this body, which is what a deferred is.
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          resolve(false);
        }, BUDGET_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** An adapter on the Node transport, listening. */
async function serving(): Promise<{
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
}> {
  const adapter = new ServerAdapter({
    transport: nodeServer(),
  });
  const app = await NestFactory.create(QuietModule, adapter, {
    logger: false,
  });
  await app.listen(ANY_PORT, LOCALHOST);
  return { adapter, app };
}

/** The server, as the code that replaces its close sees it. */
function closing(adapter: ServerAdapter): CallbackClose {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter replaced this method at runtime, so what it answers with takes a callback while the port's declared signature does not; src/servers/node.ts casts the same way.
  return adapter.getHttpServer() as unknown as CallbackClose;
}

test('the callback of a server close is invoked', async () => {
  const { adapter, app } = await serving();
  const seen: (Error | undefined)[] = [];
  await closing(adapter).close((error) => {
    seen.push(error);
  });
  expect(seen).toHaveLength(1);
  expect(seen[0]).toBeUndefined();
  await app.close();
});

test('the callback receives the error of a server that never listened', async () => {
  const { adapter, app } = await serving();
  await app.close();
  const seen: (Error | undefined)[] = [];
  await closing(adapter).close((error) => {
    seen.push(error);
  });
  expect(String(seen[0])).toContain('not running');
});

test('the boolean the Nest lifecycle passes still closes the server', async () => {
  const { app } = await serving();
  const close = app.close();
  expect(await settled(close)).toBe(true);
  expect(close).resolves.toBeUndefined();
});
