import { expect, test } from 'bun:test';

import { bridgeNames, discoverBridges } from '#adapter/compat/index';
import { bridge } from '#inertia/index';

import { request, startProbe } from '#test/probe';

import { inertiaModule } from './fixture.ts';

const PASS_THROUGH = 200;

const FOUND = 302;

const SEE_OTHER = 303;

const NOT_MODIFIED_LOCATION = 308;

const VERSION_CONFLICT = 409;

const MOVED_PERMANENTLY = 301;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const pageOf = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) throw new TypeError('the answer is not a page');
  return body;
};

const visit = (headers: Record<string, string> = {}): RequestInit => {
  const all: Record<string, string> = { 'x-inertia': 'true' };
  for (const [name, value] of Object.entries(headers)) all[name] = value;
  return { headers: all };
};

const visitPut = (): RequestInit => ({
  headers: { 'x-inertia': 'true' },
  method: 'PUT',
  redirect: 'manual',
});

test('the region finds the installed bridge package on its own', async () => {
  await discoverBridges();
  expect(bridgeNames()).toContain('inertia');
});

test('the bridge is exported and defined', () => {
  expect(bridge).toBeDefined();
});

test('the stock Inertia module renders HTML on Hono without @Res()', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/');
    expect(response.status).toBe(PASS_THROUGH);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toContain('"component":"Home"');
    expect(response.text).toContain('"greeting":"hello"');
  } finally {
    await probe.close();
  }
});

test('an Inertia visit renders the JSON page', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/', visit());
    expect(response.status).toBe(PASS_THROUGH);
    expect(response.contentType).toContain('application/json');
    expect(pageOf(response.body)).toMatchObject({
      component: 'Home',
      props: { greeting: 'hello' },
      url: '/',
    });
    expect(response.headers.get('x-inertia')).toBe('true');
  } finally {
    await probe.close();
  }
});

test('a partial reload resolves only the props it was asked for', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(
      probe,
      '/partial',
      visit({
        'x-inertia-partial-component': 'Partial',
        'x-inertia-partial-data': 'first',
      }),
    );
    expect(pageOf(response.body).props).toStrictEqual({ errors: {}, first: 'one' });
  } finally {
    await probe.close();
  }
});

test('a deferred prop is announced and then resolved by its partial reload', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const first = await request(probe, '/partial', visit());
    const page = pageOf(first.body);
    expect(page.props).toMatchObject({ first: 'one', second: 'two' });
    expect(page.props).not.toHaveProperty('third');
    expect(page.deferredProps).toStrictEqual({ default: ['third'] });

    const second = await request(
      probe,
      '/partial',
      visit({
        'x-inertia-partial-component': 'Partial',
        'x-inertia-partial-data': 'third',
      }),
    );
    expect(pageOf(second.body).props).toStrictEqual({ errors: {}, third: 'later' });
  } finally {
    await probe.close();
  }
});

test('a once prop is announced with its cache key', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/once', visit());
    const page = pageOf(response.body);
    expect(page.props).toStrictEqual({ cached: 'yes', errors: {} });
    expect(page.onceProps).toMatchObject({ cached: { prop: 'cached' } });
  } finally {
    await probe.close();
  }
});

test('a stale asset version answers 409 with the location', async () => {
  const probe = await startProbe({ module: inertiaModule({ version: 'v1' }) });
  try {
    const response = await request(probe, '/', visit({ 'x-inertia-version': 'stale' }));
    expect(response.status).toBe(VERSION_CONFLICT);
    expect(response.headers.get('x-inertia-location')).toBe('/');
  } finally {
    await probe.close();
  }
});

test('location() answers 409 for an Inertia visit and 302 for a browser', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const visited = await request(probe, '/location', visit());
    expect(visited.status).toBe(VERSION_CONFLICT);
    expect(visited.headers.get('x-inertia-location')).toBe('/elsewhere');

    const browser = await request(probe, '/location', { redirect: 'manual' });
    expect(browser.status).toBe(FOUND);
    expect(browser.headers.get('location')).toBe('/elsewhere');
  } finally {
    await probe.close();
  }
});

test('@Redirect() upgrades a 302 to 303 for an Inertia visit', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/redirect', visitPut());
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('location')).toBe('/done');
  } finally {
    await probe.close();
  }
});

test('@Redirect() keeps an explicit status', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/redirect-explicit', visitPut());
    expect(response.status).toBe(NOT_MODIFIED_LOCATION);
  } finally {
    await probe.close();
  }
});

test('res.redirect() upgrades a 302 to 303 for an Inertia visit', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/manual', visitPut());
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('location')).toBe('/done');
  } finally {
    await probe.close();
  }
});

test('res.redirect() keeps an explicit status', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/manual-explicit', visitPut());
    expect(response.status).toBe(MOVED_PERMANENTLY);
  } finally {
    await probe.close();
  }
});

test('res.redirect(302, url) is upgraded like the one-argument shape', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/manual-found', visitPut());
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('location')).toBe('/done');
  } finally {
    await probe.close();
  }
});

test('a browser redirect is untouched', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/redirect', { method: 'PUT', redirect: 'manual' });
    expect(response.status).toBe(FOUND);
  } finally {
    await probe.close();
  }
});

test('a route without Inertia still answers through the adapter', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    const response = await request(probe, '/plain');
    expect(response.status).toBe(PASS_THROUGH);
    expect(response.body).toStrictEqual({ ok: true });
  } finally {
    await probe.close();
  }
});

test('the adapter patches are fitted per application', async () => {
  const probe = await startProbe({ module: inertiaModule() });
  try {
    expect(Object.hasOwn(probe.adapter, 'reply')).toBe(true);
    expect(Object.hasOwn(probe.adapter, 'redirect')).toBe(true);
  } finally {
    await probe.close();
  }
});
