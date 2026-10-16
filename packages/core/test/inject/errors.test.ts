import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { app, registerApplication } from './support.ts';

registerApplication();

test('answers a thrown HttpException as Nest does', async () => {
  const application = await app();
  const answer = await application.inject('/boom');
  const body: unknown = answer.json();
  expect(answer.statusCode).toBe(HttpStatus.FORBIDDEN);
  expect(body).toMatchObject({
    message: 'nope',
    statusCode: HttpStatus.FORBIDDEN,
  });
});

test('refuses an option it cannot honour', async () => {
  const application = await app();
  let refusal = '';
  try {
    await application.inject({
      remoteAddress: '127.0.0.1',
      url: '/ping',
    });
  } catch (error) {
    if (error instanceof Error) refusal = error.message;
  }
  expect(refusal).toContain('remoteAddress');
});
