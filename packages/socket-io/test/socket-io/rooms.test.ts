import { expect, test } from 'bun:test';

import { BROADCAST, GREETING, JOIN, ROOM } from './gateways.ts';
import type { Started } from './support.ts';
import { open, quiet, start } from './support.ts';

const roomBroadcast = async (started: Started): Promise<string[]> => {
  const heard: string[] = [];
  const listen = (text: string): void => {
    heard.push(text);
  };
  const [inside, outside] = await Promise.all([open(started.url), open(started.url)]);
  inside.on(BROADCAST, listen);
  outside.on(BROADCAST, listen);
  expect(await inside.emitWithAck(JOIN, ROOM)).toBe('joined');
  await quiet();
  inside.close();
  outside.close();
  return heard;
};

test('a room broadcast reaches only the client in the room', async () => {
  const started = await start();
  expect(await roomBroadcast(started)).toStrictEqual([GREETING]);
  await started.close();
});
