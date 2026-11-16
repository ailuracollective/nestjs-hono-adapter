import { expect, test } from 'bun:test';
import { request } from '#test/probe';

import {
  CONFLICT,
  FOUND,
  INERTIA,
  MOVED_PERMANENTLY,
  SEE_OTHER,
  deleteStatus,
  headers,
  probeOf,
} from './support.ts';

test('@Redirect default 302 becomes 303 for an Inertia DELETE', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users/1', { headers: INERTIA, method: 'DELETE' });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('location')).toBe('/users');
    expect(response.headers.get('vary')).toContain('X-Inertia');
  } finally {
    await probe.close();
  }
});

test('an Inertia redirect with a fragment answers 409 with X-Inertia-Redirect', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users-fragment/1', {
      headers: INERTIA,
      method: 'DELETE',
    });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-redirect')).toMatch(/^https?:\/\/.+\/users#section$/u);
    expect(response.headers.get('vary')).toContain('X-Inertia');
  } finally {
    await probe.close();
  }
});

test('res.redirect with a fragment does the same', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users-fragment-res/1', {
      headers: INERTIA,
      method: 'DELETE',
    });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-redirect')).toMatch(/^https?:\/\/.+\/users#section$/u);
  } finally {
    await probe.close();
  }
});

test('a prefetch request receives the fragment redirect unchanged', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/fragment', {
      headers: headers({ Purpose: 'prefetch' }),
    });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('location')).toBe('/users#section');
    expect(response.headers.get('vary')).toContain('X-Inertia');
  } finally {
    await probe.close();
  }
});

test('a non-prefetch Inertia GET with a fragment answers 409', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/fragment', { headers: INERTIA });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-redirect')).toMatch(/^https?:\/\/.+\/users#section$/u);
  } finally {
    await probe.close();
  }
});

test.each([
  ['/users-res/1', SEE_OTHER],
  ['/users-express-301/1', MOVED_PERMANENTLY],
  ['/users-hono-301/1', MOVED_PERMANENTLY],
  ['/users-express-302/1', SEE_OTHER],
  ['/users-hono-302/1', SEE_OTHER],
  ['/users-decorator-301/1', MOVED_PERMANENTLY],
] as const)('%s answers %i for an Inertia DELETE', async (path, status) => {
  expect(await deleteStatus(path, INERTIA)).toBe(status);
});

test('res.redirect without an Inertia request keeps its status', async () => {
  expect(await deleteStatus('/users-res/1')).toBe(FOUND);
});

test('a Hono-style explicit status without Inertia is preserved', async () => {
  expect(await deleteStatus('/users-hono-301/1')).toBe(MOVED_PERMANENTLY);
});

test('a redirect without an Inertia request stays 302', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users/1', { method: 'DELETE' });
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('location')).toBe('/users');
  } finally {
    await probe.close();
  }
});

test('location() answers a full visit with 409 and the destination', async () => {
  const probe = await probeOf();
  try {
    const inertia = await request(probe, '/location', { headers: INERTIA });
    expect(inertia.status).toBe(CONFLICT);
    expect(inertia.headers.get('x-inertia-location')).toBe('/out');

    const browser = await request(probe, '/location');
    expect(browser.status).toBe(FOUND);
    expect(browser.headers.get('location')).toBe('/out');
  } finally {
    await probe.close();
  }
});
