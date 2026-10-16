import { expect, test } from 'bun:test';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { GATEWAY_PATH, INPUT, OTHER_PATH, PING } from './gateways.ts';
import { ask, expectAnswered, open, socketUrl, startGateways } from './support.ts';

test('a gateway answers on the Hono server', async () => {
  const probe = await startGateways();
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(socket, { amount: INPUT });
  } finally {
    socket.close();
    await probe.close();
    await probe.close();
  }
});

test('a gateway answers on the Node transport', async () => {
  const probe = await startGateways(new ServerAdapter({ transport: nodeServer() }));
  const socket = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(socket, { amount: INPUT });
  } finally {
    socket.close();
    await probe.close();
    await probe.close();
  }
});

test('one socket closing leaves another socket answering', async () => {
  const probe = await startGateways();
  const first = await open(socketUrl(probe, GATEWAY_PATH));
  const second = await open(socketUrl(probe, GATEWAY_PATH));
  try {
    await expectAnswered(first, { amount: INPUT });
    first.close();
    await expectAnswered(second, { amount: INPUT });
  } finally {
    second.close();
    await probe.close();
  }
});

test('each gateway path is served on a route of its own', async () => {
  const probe = await startGateways();
  const other = await open(socketUrl(probe, OTHER_PATH));
  try {
    const answer = await ask(other, {});
    expect(answer).toStrictEqual({ data: { path: OTHER_PATH }, event: PING });
  } finally {
    other.close();
    await probe.close();
  }
});
