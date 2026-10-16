import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { ServerAdapter } from '#adapter/index';
import { nodeServer } from '#adapter/servers/node';
import { bunAdapter } from '#test/bun-adapter';
import { request } from '#test/probe';
import { startAdapter } from './support/index.ts';

const answersBeside = async (): Promise<void> => {
  const probe = await startAdapter(bunAdapter());
  try {
    const answer = await request(probe, '/ping');
    expect(answer.status).toBe(HttpStatus.OK);
    expect(answer.body).toStrictEqual({ pong: true });
  } finally {
    await probe.close();
  }
};

test('a Node transport with the global override on leaves a Bun application alone', async () => {
  const overridden = await startAdapter(
    new ServerAdapter({
      transport: nodeServer({ overrideGlobalObjects: true }),
    }),
  );
  try {
    const own = await request(overridden, '/ping');
    expect(own.status).toBe(HttpStatus.OK);
    await answersBeside();
  } finally {
    await overridden.close();
  }
});
