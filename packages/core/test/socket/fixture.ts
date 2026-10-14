import { Hono } from 'hono';

import {
  CarrierSocket,
  RequestCarrier,
} from '#adapter/core/ports/bindings';
import type {
  Bindings,
  Socket,
} from '#adapter/core/ports/bindings';
import { toNestRequest } from '#adapter/core/request/request';
import type {
  NestContext,
  NestEnv,
  NestRequest,
} from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

const TUNING = [
  'setKeepAlive',
  'setNoDelay',
  'setTimeout',
] as const;

/** A socket whose runtime provides the tuning calls itself. */
const socketWithTuning = (): Socket => {
  const socket = new CarrierSocket('127.0.0.1');
  const tuning = (): Socket => socket;
  socket.setKeepAlive = tuning;
  socket.setNoDelay = tuning;
  socket.setTimeout = tuning;
  return socket;
};

/** The request the translation builds over a synthesized socket. */
const bagOver = async (): Promise<NestRequest> => {
  const incoming = new RequestCarrier('127.0.0.1');
  const binding = {
    incoming,
    server: SYNTHETIC_SERVER,
  } satisfies Bindings;
  const app = new Hono<NestEnv>();
  const captured: NestContext[] = [];
  app.get('/read', (context) => {
    captured.push(context);
    return context.text('ok');
  });
  await app.request('/read', undefined, binding);
  const [context] = captured;
  if (context === undefined) {
    throw new Error('the route did not run');
  }
  return toNestRequest(context, { trustProxy: false });
};

export { TUNING, bagOver, socketWithTuning };
