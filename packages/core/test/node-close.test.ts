import { expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';

const ANY_PORT = 0;
const LOCALHOST = '127.0.0.1';
const BUDGET_MS = 2000;

interface CallbackClose {
  readonly close: (answer: (error?: Error) => void) => Promise<void>;
}

@Module({})
class QuietModule {}

const settled = async (work: Promise<unknown>): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
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
};

const serving = async (): Promise<{
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
}> => {
  const adapter = new ServerAdapter({
    transport: nodeServer(),
  });
  const app = await NestFactory.create(QuietModule, adapter, {
    logger: false,
  });
  await app.listen(ANY_PORT, LOCALHOST);
  return { adapter, app };
};

const closing = (adapter: ServerAdapter): CallbackClose =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter replaced this method at runtime, so what it answers with takes a callback while the port's declared signature does not; src/servers/node.ts casts the same way.
  adapter.getHttpServer() as unknown as CallbackClose;

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
