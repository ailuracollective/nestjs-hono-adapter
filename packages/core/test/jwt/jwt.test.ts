import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';

import {
  FORGED_LIFETIME,
  MILLISECONDS_PER_SECOND,
  SUBJECT,
  TokenModule,
} from './fixture.ts';
import { authorized, tokenOf, withProbe } from './support.ts';

test('a token signed in the application verifies in the application', async () => {
  await withProbe(async (probe) => {
    const signed = await request(probe, '/token');
    expect(signed.status).toBe(HttpStatus.OK);

    const verified = await request(
      probe,
      '/verify',
      authorized(tokenOf(signed.body)),
    );

    expect(verified.status).toBe(HttpStatus.OK);
    expect(verified.body).toStrictEqual({ subject: SUBJECT });
  });
});

test('a guarded route refuses a request that carries no token', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/guarded');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

test('a guarded route refuses a token signed with another secret', async () => {
  await withProbe(async (probe) => {
    const expiresAt =
      Math.floor(Date.now() / MILLISECONDS_PER_SECOND) +
      FORGED_LIFETIME;
    const claims = Buffer.from(
      JSON.stringify({ exp: expiresAt, sub: SUBJECT }),
    ).toString('base64url');
    const forged = `${claims}.forged-signature`;

    const response = await request(
      probe,
      '/guarded',
      authorized(forged),
    );

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

test('a guarded route accepts a token the application signed', async () => {
  await withProbe(async (probe) => {
    const issued = await request(probe, '/token');
    const response = await request(
      probe,
      '/guarded',
      authorized(tokenOf(issued.body)),
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ sub: SUBJECT });
  });
});

test('a guarded route answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: TokenModule,
  });
  try {
    const issued = await request(probe, '/token');
    const response = await request(
      probe,
      '/guarded',
      authorized(tokenOf(issued.body)),
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(
      JSON.stringify({ sub: SUBJECT }),
    );
  } finally {
    await probe.close();
  }
});
