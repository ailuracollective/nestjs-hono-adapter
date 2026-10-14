import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { ConcurrencyModule } from './fixture.ts';

/** How many requests are kept in flight together. */
const IN_FLIGHT = 25;

test('many requests in flight keep their own request context', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ConcurrencyModule,
  });
  try {
    const ids = Array.from(
      { length: IN_FLIGHT },
      (_value, index) => `id-${index}`,
    );
    const answers = await Promise.all(
      ids.map((id) => request(probe, `/who?id=${id}`)),
    );
    for (const [index, answer] of answers.entries()) {
      const id = ids[index];
      expect(answer.status).toBe(HttpStatus.OK);
      expect(answer.body).toStrictEqual({
        id,
        scoped: id,
      });
    }
  } finally {
    await probe.close();
  }
});
