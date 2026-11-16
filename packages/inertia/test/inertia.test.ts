import { expect, test } from 'bun:test';
import { bridgeNames, ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { request, startProbe } from '#test/probe';

import { inertiaModule } from './fixture.ts';

const INERTIA = { 'X-Inertia': 'true' };
const OK = 200;
const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const CONFLICT = 409;

const probeOf = (): ReturnType<typeof startProbe> =>
  startProbe({ mode: 'in-process', module: inertiaModule() });

const headers = (extra: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { 'X-Inertia': 'true' };
  for (const [key, value] of Object.entries(extra)) out[key] = value;
  return out;
};

const partialHeaders = (data: string): Record<string, string> =>
  headers({
    'X-Inertia-Partial-Component': 'Users/Index',
    'X-Inertia-Partial-Data': data,
  });

const deleteStatus = async (
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<number> => {
  const probe = await probeOf();
  try {
    const init: RequestInit =
      extraHeaders === undefined
        ? { method: 'DELETE' }
        : { headers: extraHeaders, method: 'DELETE' };
    const response = await request(probe, path, init);
    return response.status;
  } finally {
    await probe.close();
  }
};

const pageComponent = (text: string): unknown => {
  const pageJson =
    /<script data-page="app" type="application\/json">(?<json>[\s\S]*?)<\/script>/u.exec(text);
  const groups = pageJson === null ? undefined : pageJson.groups;
  const json = groups === undefined ? undefined : groups.json;
  return json === undefined ? undefined : JSON.parse(json);
};

test('the region finds the installed bridge package on its own', async () => {
  const probe = await probeOf();
  await probe.close();
  expect(bridgeNames()).toContain('inertia');
});

test('the bridge patches the adapter instance, not its prototype', async () => {
  const prototypeReply = Reflect.get(ServerAdapter.prototype, 'reply');
  const prototypeRedirect = Reflect.get(ServerAdapter.prototype, 'redirect');
  const probe = await probeOf();
  try {
    expect(Reflect.get(ServerAdapter.prototype, 'reply')).toBe(prototypeReply);
    expect(Reflect.get(ServerAdapter.prototype, 'redirect')).toBe(prototypeRedirect);
    expect(Reflect.get(probe.adapter, 'reply')).not.toBe(prototypeReply);
  } finally {
    await probe.close();
  }
});

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

test('a version mismatch answers 409 with the location', async () => {
  const probe = await probeOf();
  try {
    const versioned = headers({ 'X-Inertia-Version': 'old' });
    const response = await request(probe, '/users', { headers: versioned });
    expect(response.status).toBe(CONFLICT);
    expect(response.headers.get('x-inertia-location')).toBe('/users');
  } finally {
    await probe.close();
  }
});

test('@Redirect default 302 becomes 303 for an Inertia DELETE', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/users/1', { headers: INERTIA, method: 'DELETE' });
    expect(response.status).toBe(SEE_OTHER);
    expect(response.headers.get('location')).toBe('/users');
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

test('a plain route is unaffected by the reply guard', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/plain');
    expect(response.status).toBe(OK);
    expect(response.body).toEqual({ ok: true });
  } finally {
    await probe.close();
  }
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
