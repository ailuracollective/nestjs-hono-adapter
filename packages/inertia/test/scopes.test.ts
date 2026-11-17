import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import { scopesModule } from './fixtures/scopes.ts';
import { CONFLICT, INERTIA, OK, headers, probeFor } from './support.ts';

test('the root scope renders its component, version and shared props', async () => {
  const probe = await probeFor(scopesModule());
  try {
    const response = await request(probe, '/main', { headers: INERTIA });
    expect(response.status).toBe(OK);
    expect(response.body).toMatchObject({
      component: 'Main',
      props: { app: 'main', value: 'main' },
      version: 'v1',
    });
  } finally {
    await probe.close();
  }
});

test('the feature scope uses its own version and share', async () => {
  const probe = await probeFor(scopesModule());
  try {
    const response = await request(probe, '/admin', {
      headers: headers({ 'X-Inertia-Version': 'admin-v1' }),
    });
    expect(response.status).toBe(OK);
    expect(response.body).toMatchObject({
      component: 'Admin',
      props: { app: 'admin', value: 'admin' },
      version: 'admin-v1',
    });
  } finally {
    await probe.close();
  }
});

test('the feature scope answers its own version mismatch', async () => {
  const probe = await probeFor(scopesModule());
  try {
    const response = await request(probe, '/admin', { headers: INERTIA });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-version')).toBe('admin-v1');
  } finally {
    await probe.close();
  }
});
