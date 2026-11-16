import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import {
  CONFLICT,
  INERTIA,
  OK,
  headers,
  pageComponent,
  partialHeaders,
  probeOf,
} from './support.ts';

test('@Inertia renders the page object without @Res', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users', { headers: INERTIA });
    expect(response.status).toBe(OK);
    expect(response.headers.get('x-inertia')).toBe('true');
    expect(response.headers.get('vary')).toBe('X-Inertia');
    expect(response.body).toMatchObject({
      component: 'Users/Index',
      deferredProps: { default: ['stats'] },
      onceProps: { token: { prop: 'token' } },
      props: { users: [{ id: 1, name: 'Ada' }] },
    });
  } finally {
    await probe.close();
  }
});

test('the first load answers the root document with the page object', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users');
    expect(response.status).toBe(OK);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toContain('data-page="app"');
    expect(pageComponent(response.text)).toMatchObject({ component: 'Users/Index' });
  } finally {
    await probe.close();
  }
});

test('a partial reload returns only the requested props', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users', { headers: partialHeaders('users') });
    expect(response.body).toMatchObject({
      props: { errors: {}, users: [{ id: 1, name: 'Ada' }] },
    });
  } finally {
    await probe.close();
  }
});

test('a deferred follow-up resolves the prop', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users', { headers: partialHeaders('stats') });
    expect(response.body).toMatchObject({ props: { stats: { count: 7 } } });
  } finally {
    await probe.close();
  }
});

test('a version mismatch answers 409 with the full location and version', async () => {
  const probe = await probeOf();
  try {
    const versioned = headers({ 'X-Inertia-Version': 'old' });
    const response = await request(probe, '/users', { headers: versioned });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-location')).toMatch(/^https?:\/\/.+\/users$/u);
    expect(response.headers.get('x-inertia-version')).toBe('v1');
  } finally {
    await probe.close();
  }
});

test('a missing version header is an empty version', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users', { headers: { 'X-Inertia': 'true' } });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-version')).toBe('v1');
  } finally {
    await probe.close();
  }
});
