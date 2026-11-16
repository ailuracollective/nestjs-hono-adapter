import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import { CREATED, FORBIDDEN, csrfToken, probeOf, submitCsrf } from './support.ts';

test('the CSRF cookie is issued and the guard accepts the matching token', async () => {
  const probe = await probeOf();
  try {
    const token = await csrfToken(probe);
    expect(await submitCsrf(probe, token)).toBe(CREATED);
  } finally {
    await probe.close();
  }
});

test('the CSRF guard refuses a missing token', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/csrf', { method: 'POST' });
    expect(response.status).toBe(FORBIDDEN);
  } finally {
    await probe.close();
  }
});
