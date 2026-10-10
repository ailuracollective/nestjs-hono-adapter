/**
 * The socket Nest reads when it opens an event stream.
 *
 * `SseStream`, Nest’s own, calls `setKeepAlive`, `setNoDelay`
 * and `setTimeout` on `req.socket` before it writes a frame,
 * and it watches the same socket for `close` to learn that the
 * client walked away. Bun carries a request without carrying
 * the TCP socket behind it, so these cases pin down what the
 * translation hands over in each of the two worlds, and what it
 * says on it when the client is gone.
 */

import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import {
  CarrierSocket,
  RequestCarrier,
} from '../src/core/bindings.ts';
import type { Bindings, Socket } from '../src/core/bindings.ts';
import { toNestRequest } from '../src/core/request.ts';
import {
  reportDisconnect,
  tuneableSocket,
} from '../src/core/socket.ts';
import type {
  NestEnv,
  NestContext,
  NestRequest,
} from '../src/index.ts';
import { SYNTHETIC_SERVER } from './bun-bindings.ts';

/** The calls Nest makes on a stream's socket when it opens one. */
const TUNING = [
  'setKeepAlive',
  'setNoDelay',
  'setTimeout',
] as const;

/**
 * A socket of the kind a runtime with a TCP socket behind it
 * reports: the tuning calls are its own, so the adapter must
 * leave them alone. The calls are deliberately not the
 * adapter's own stand-ins, which is what `reportDisconnect`
 * tells the two apart by.
 */
function socketWithTuning(): Socket {
  const socket = new CarrierSocket('127.0.0.1');
  const tuning = (): Socket => socket;
  socket.setKeepAlive = tuning;
  socket.setNoDelay = tuning;
  socket.setTimeout = tuning;
  return socket;
}

/**
 * The request the translation builds over a synthesized socket,
 * so a case can read what Nest would be handed.
 */
async function bagOver(): Promise<NestRequest> {
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
}

test('a socket that can be tuned is handed back untouched', () => {
  const socket = socketWithTuning();
  expect(tuneableSocket(socket)).toBe(socket);
});

test('a socket the runtime cannot tune answers the calls', () => {
  const { socket } = new RequestCarrier(undefined);
  const tuneable = tuneableSocket(socket);
  for (const name of TUNING) {
    expect(typeof tuneable[name]).toBe('function');
  }
  // The stand-ins answer with the socket, so a caller that
  // chains them still can.
  const keepAlive = tuneable.setKeepAlive;
  expect(keepAlive).toBeDefined();
  if (keepAlive === undefined) {
    throw new Error('the stand-in was not installed');
  }
  expect(keepAlive.call(tuneable, true)).toBe(tuneable);
  expect(socket.remoteAddress).toBeUndefined();
});

test('the socket a request carries answers those calls', async () => {
  const bag = await bagOver();
  for (const name of TUNING) {
    expect(typeof bag.socket[name]).toBe('function');
  }
  // The completion lands on the socket itself, so the raw
  // request carries the same one.
  expect(bag.raw.socket).toBe(bag.socket);
});

test('a socket the runtime provides reports its own end', () => {
  const socket = socketWithTuning();
  const closed: string[] = [];
  socket.on('close', () => {
    closed.push('closed');
  });
  reportDisconnect(socket);
  // A second close would be a lie about a connection that is
  // still open, and the runtime will say it itself.
  expect(closed).toEqual([]);
});

test('a socket the runtime left incomplete is told', () => {
  const { socket } = new RequestCarrier(undefined);
  const tuneable = tuneableSocket(socket);
  let closed = 0;
  tuneable.on('close', () => {
    closed += 1;
  });
  reportDisconnect(tuneable);
  expect(closed).toBe(1);
});
