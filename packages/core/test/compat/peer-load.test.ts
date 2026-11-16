import { afterEach, expect, test } from 'bun:test';

import {
  bridgeNames,
  installBridges,
  registerBridge,
  resetBridges,
  settleBridges,
} from '#adapter/compat/index';
import type { Bridge } from '#adapter/compat/index';
import { clearPeers, loadPeer, registerPeer } from '#adapter/compat/peer-load';

import { fakeBridge, targetOver } from './fixture.ts';

/** A specifier no runtime resolves: what a compiled executable answers for a bundled peer. */
const ABSENT = '@ailura/a-peer-only-a-compiled-executable-carries';

const SENTINEL = { sentinel: true };

afterEach(() => {
  clearPeers();
  resetBridges();
});

test('a declared peer is what loadPeer answers', async () => {
  registerPeer(ABSENT, SENTINEL);
  expect(await loadPeer(ABSENT)).toBe(SENTINEL);
});

test('a declaration is consulted before the runtime resolves', async () => {
  registerPeer('@nestjs/common', SENTINEL);
  expect(await loadPeer('@nestjs/common')).toBe(SENTINEL);
});

test('an undeclared peer resolves the way it always did', async () => {
  expect(await loadPeer('@nestjs/common')).toBeDefined();
});

test('an absent peer is an absent capability', async () => {
  expect(await loadPeer(ABSENT)).toBeUndefined();
});

test('a discovered bridge installs once a compiled executable declares its peer', async () => {
  const bridge = fakeBridge('ws');
  registerPeer('@ailura/nestjs-platform-hono-ws', { bridge });
  installBridges(targetOver());
  await settleBridges();
  expect(bridgeNames()).toContain('ws');
  expect(bridge.installs).toBe(1);
});

test('a bridge registered by hand bails on an absent peer, and installs once one is declared', async () => {
  let installs = 0;
  const bridge: Bridge = {
    install: async () => {
      if ((await loadPeer(ABSENT)) !== undefined) installs += 1;
    },
    name: 'inertia',
  };
  registerBridge(bridge);
  installBridges(targetOver());
  await settleBridges();
  expect(installs).toBe(0);

  registerPeer(ABSENT, SENTINEL);
  installBridges(targetOver());
  await settleBridges();
  expect(installs).toBe(1);
});
