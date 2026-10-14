import { loadPeer } from '@ailura/nestjs-hono-adapter';
import type { BridgeTarget, Server } from '@ailura/nestjs-hono-adapter';
import type { ServerOptions } from 'socket.io';

import { attachEngine } from './engine.ts';
import { loadKit } from './kit.ts';
import type { Kit } from './kit.ts';
import { assertAttachable } from './refusal.ts';

const PEER = '@nestjs/platform-socket.io';

const ATTACHED_PORT = 0;

interface IoAdapterShape {
  readonly httpServer: Server;
  createIOServer: (port: number, options?: ServerOptions) => unknown;
}

const patched = new WeakSet<object>();

const targets: BridgeTarget[] = [];

const remember = (target: BridgeTarget): void => {
  if (!targets.some((one) => one.hono === target.hono)) targets.push(target);
};

/** The class the peer publishes, and the prototype a patch is written on. */
const prototypeOf = (peer: unknown): IoAdapterShape | undefined => {
  const adapter: unknown =
    typeof peer === 'object' && peer !== null ? Reflect.get(peer, 'IoAdapter') : undefined;
  const prototype: unknown =
    typeof adapter === 'function' ? Reflect.get(adapter, 'prototype') : undefined;
  return typeof prototype === 'object' && prototype !== null
    ? (prototype as IoAdapterShape)
    : undefined;
};

/**
 * `createIOServer()` is the one member that builds a server, so replacing it is the whole bridge:
 * the peer's own `create`, `bindMessageHandlers`, `bindClientDisconnect` and `close` run on what it
 * returns.
 */
const fit = (prototype: IoAdapterShape, kit: Kit | undefined): void => {
  const original = prototype.createIOServer;
  prototype.createIOServer = function createIOServer(
    this: IoAdapterShape,
    port: number,
    options?: ServerOptions,
  ): unknown {
    const target = targets.find((one) => one.server() === this.httpServer);
    if (target === undefined || port !== ATTACHED_PORT) return original.call(this, port, options);
    const attached = attachEngine(this.httpServer, kit, options);
    if (attached !== undefined) return attached;
    // No engine means either Node's own server, which the peer attaches to as it stands, or nothing.
    assertAttachable(this.httpServer);
    return original.call(this, port, options);
  };
};

const patchIoAdapter = async (target: BridgeTarget): Promise<void> => {
  remember(target);
  const [peer, kit] = await Promise.all([loadPeer(PEER), loadKit()]);
  const prototype = prototypeOf(peer);
  if (prototype === undefined || patched.has(prototype)) return;
  patched.add(prototype);
  fit(prototype, kit);
};

export { patchIoAdapter };
