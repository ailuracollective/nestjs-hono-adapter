/**
 * The socket Nest reads when it opens an event stream.
 *
 * `SseStream`, Nest’s own, calls `setKeepAlive`, `setNoDelay`
 * and `setTimeout` on `req.socket` before it writes a frame,
 * and it watches the same socket for `close` to learn that the
 * client walked away. A runtime can carry the request without
 * carrying the socket behind it, so these cases pin down what
 * the translation hands over in each of the two worlds, and
 * what it says on it when the client is gone.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import { toNestRequest } from '../src/core/request.ts';
import {
  reportDisconnect,
  tuneableSocket,
} from '../src/core/socket.ts';
import type {
  NestContext,
  NestRequest,
  NodeEnv,
} from '../src/index.ts';

/** The calls Nest makes on a stream's socket when it opens one. */
const TUNING = [
  'setKeepAlive',
  'setNoDelay',
  'setTimeout',
] as const;

/**
 * A socket of the kind a runtime with no TCP socket behind it
 * reports: the members everything else reads, and none of the
 * tuning. Cloudflare Workers reports one through
 * `cloudflare:node` carrying `on`, `once` and `remoteAddress`.
 *
 * A real socket is used, with the three calls taken off it, so
 * the case cannot pass on a stand-in that answers to something
 * else as well.
 */
function socketWithoutTuning(): Socket {
  const socket = new Socket();
  for (const name of TUNING) {
    Reflect.set(socket, name, undefined);
  }
  return socket;
}

/**
 * The request the translation builds over a socket, so a case
 * can read what Nest would be handed.
 */
async function bagOver(socket: Socket): Promise<NestRequest> {
  const incoming = new IncomingMessage(socket);
  const binding = {
    incoming,
    outgoing: new ServerResponse(incoming),
  } satisfies NodeEnv['Bindings'];
  const app = new Hono<NodeEnv>();
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
  const socket = new Socket();
  expect(tuneableSocket(socket)).toBe(socket);
});

test('a socket the runtime cannot tune answers the calls', () => {
  const socket = tuneableSocket(socketWithoutTuning());
  for (const name of TUNING) {
    expect(typeof socket[name]).toBe('function');
  }
  // The real calls answer with the socket, so a caller that
  // chains them still can.
  const chained = socket
    .setKeepAlive(true)
    .setNoDelay(true)
    .setTimeout(0);
  expect(chained).toBe(socket);
  expect(socket.remoteAddress).toBeUndefined();
});

test('the socket a request carries answers those calls', async () => {
  const bag = await bagOver(socketWithoutTuning());
  for (const name of TUNING) {
    expect(typeof bag.socket[name]).toBe('function');
  }
  // The completion lands on the socket itself, so the raw
  // request carries the same one.
  expect(bag.raw.socket).toBe(bag.socket);
});

test('a socket the runtime provides reports its own end', () => {
  const socket = new Socket();
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
  const socket = tuneableSocket(socketWithoutTuning());
  let closed = 0;
  socket.on('close', () => {
    closed += 1;
  });
  reportDisconnect(socket);
  expect(closed).toBe(1);
});
