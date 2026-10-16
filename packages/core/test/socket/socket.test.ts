import { expect, test } from 'bun:test';

import { RequestCarrier } from '#adapter/core/ports/bindings';
import { reportDisconnect, tuneableSocket } from '#adapter/core/server/socket';

import { TUNING, bagOver, socketWithTuning } from './fixture.ts';

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
  const keepAlive = tuneable.setKeepAlive;
  expect(keepAlive).toBeDefined();
  if (keepAlive === undefined) throw new Error('the stand-in was not installed');
  expect(keepAlive.call(tuneable, true)).toBe(tuneable);
  expect(socket.remoteAddress).toBeUndefined();
});

test('the socket a request carries answers those calls', async () => {
  const bag = await bagOver();
  const { raw, socket } = bag;
  if (raw === undefined || socket === undefined) throw new Error('the request answered no socket');
  for (const name of TUNING) {
    expect(typeof socket[name]).toBe('function');
  }
  expect(raw.socket).toBe(socket);
});

test('a socket the runtime provides reports its own end', () => {
  const socket = socketWithTuning();
  const closed: string[] = [];
  socket.on('close', () => {
    closed.push('closed');
  });
  reportDisconnect(socket);
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
