import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import { FLASH_SESSION, SEE_OTHER, VALIDATION_SESSION, headers, probeOf } from './support.ts';

test('an error bag scopes the errors prop', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/bag', {
      headers: headers({ 'X-Inertia-Error-Bag': 'login' }),
    });
    expect(response.body).toMatchObject({
      props: { errors: { login: { email: 'Invalid' } } },
    });
  } finally {
    await probe.close();
  }
});

test('validation errors flash and redirect back', async () => {
  const probe = await probeOf();
  try {
    const post = await request(probe, '/validate', {
      headers: headers({
        Host: 'localhost',
        Referer: 'http://localhost/users',
        'X-Test-Session': VALIDATION_SESSION,
      }),
      method: 'POST',
    });
    expect(post.status).toBe(SEE_OTHER);
    expect(post.headers.get('location')).toBe('/users');

    const get = await request(probe, '/users', {
      headers: headers({ 'X-Test-Session': VALIDATION_SESSION }),
    });
    expect(get.body).toMatchObject({ props: { errors: { email: 'Invalid' } } });
  } finally {
    await probe.close();
  }
});

test('general flash data survives to the next request', async () => {
  const probe = await probeOf();
  try {
    const post = await request(probe, '/flash', {
      headers: headers({ 'X-Test-Session': FLASH_SESSION }),
      method: 'POST',
    });
    expect(post.status).toBe(SEE_OTHER);

    const get = await request(probe, '/users', {
      headers: headers({ 'X-Test-Session': FLASH_SESSION }),
    });
    expect(get.body).toMatchObject({ props: { flash: { success: 'Saved' } } });
  } finally {
    await probe.close();
  }
});
