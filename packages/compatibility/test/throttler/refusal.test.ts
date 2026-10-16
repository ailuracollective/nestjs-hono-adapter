import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import { ALLOWED, LIMIT, ThrottledModule } from './fixture.ts';
import { exhaust, withProbe } from './support.ts';

test('requests up to the limit are all answered', async () => {
  await withProbe(async (probe) => {
    const answers = await Promise.all(Array.from({ length: LIMIT }, () => request(probe, '/ping')));

    expect(answers.map((answered) => answered.status)).toStrictEqual(
      Array.from({ length: LIMIT }, () => HttpStatus.OK),
    );
  });
});

test('the request past the limit is refused by the guard', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/ping');

    const refused = await request(probe, '/ping');

    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});

test('a refusal carries the body the package wrote, not the route s', async () => {
  await withProbe(async (probe) => {
    await exhaust(probe, '/once');

    const refused = await request(probe, '/once');

    expect(refused.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(refused.body).toStrictEqual({
      message: 'ThrottlerException: Too Many Requests',
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});

test('the guard answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: ThrottledModule,
  });
  try {
    const response = await request(probe, '/ping');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify(ALLOWED));
  } finally {
    await probe.close();
  }
});
