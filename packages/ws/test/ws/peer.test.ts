import { expect, test } from 'bun:test';

import { WsAdapter } from '@nestjs/platform-ws';
import { Hono } from 'hono';

import type { NestEnv } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { patchWsAdapter } from '#ws/patch';

const create = (): unknown => Reflect.get(WsAdapter.prototype, 'create');

test('a peer the runtime cannot resolve is served the class the bundler resolved', async () => {
  // The target is made here and not by an application: the region's discovery
  // patches the class, and the case has to record the one it replaces.
  const hono = new Hono<NestEnv>();
  const transport = nodeServer({ overrideGlobalObjects: false });
  const server = transport.createServer(hono, {});
  const stock = create();
  await patchWsAdapter({ hono, server: () => server, transport }, (): Promise<unknown> =>
    Promise.resolve(),
  );
  expect(create()).not.toBe(stock);
});
