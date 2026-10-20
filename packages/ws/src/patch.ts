import { loadPeer } from '@ailura/nestjs-hono-adapter';
import type { BridgeTarget, Server } from '@ailura/nestjs-hono-adapter';
import { WsAdapter } from '@nestjs/platform-ws';

import { ensureSupported, normalizePath } from './options.ts';
import type { GatewayOptions } from './options.ts';
import { appFor, mount } from './serve.ts';
import type { Served } from './serve.ts';
import type { GatewayServer } from './server.ts';

const PEER = '@nestjs/platform-ws';

interface WsAdapterShape {
  readonly httpServer: Server;
  bindErrorHandler: (server: GatewayServer) => unknown;
  create: (port: number, options?: GatewayOptions) => unknown;
}

const patched = new WeakSet<object>();

const targets: BridgeTarget[] = [];

const remember = (target: BridgeTarget): void => {
  if (!targets.some((one) => one.hono === target.hono)) targets.push(target);
};

/** The class the peer publishes, and the prototype a patch is written on. */
const prototypeOf = (peer: unknown): WsAdapterShape | undefined => {
  const adapter: unknown =
    typeof peer === 'object' && peer !== null ? Reflect.get(peer, 'WsAdapter') : undefined;
  const prototype: unknown =
    typeof adapter === 'function' ? Reflect.get(adapter, 'prototype') : undefined;
  return typeof prototype === 'object' && prototype !== null
    ? (prototype as WsAdapterShape)
    : undefined;
};

/**
 * `create()` is the one member that builds a server, so replacing it is the whole bridge: Nest's
 * own `bindMessageHandlers`, `bindErrorHandler` and `close` then run against the server made here.
 */
const fit = (prototype: WsAdapterShape): void => {
  const original = prototype.create;
  const served = new WeakMap<BridgeTarget, Served>();
  prototype.create = function create(
    this: WsAdapterShape,
    port: number,
    options: GatewayOptions = {},
  ): unknown {
    const target = targets.find((one) => one.server() === this.httpServer);
    if (target === undefined) return original.call(this, port, options);
    const app = appFor(served, target);
    // No websocket helper means Node's own server, where platform-ws's `ws.Server` fits as it is.
    if (app === undefined) return original.call(this, port, options);
    ensureSupported(port, options);
    return mount(this, app, normalizePath(options.path));
  };
};

/** The peer as the bundler resolved it, for a runtime that resolves no specifier by name. */
const bundled = { WsAdapter };

const patchWsAdapter = async (
  target: BridgeTarget,
  load: () => Promise<unknown> = (): Promise<unknown> => loadPeer(PEER),
): Promise<void> => {
  remember(target);
  // The peer's own resolution is the one the application holds.
  const prototype = prototypeOf((await load()) ?? bundled);
  if (prototype === undefined || patched.has(prototype)) return;
  patched.add(prototype);
  fit(prototype);
};

export { patchWsAdapter };
