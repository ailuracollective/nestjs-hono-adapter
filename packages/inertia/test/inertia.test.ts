import '#inertia/register';

import { expect, test } from 'bun:test';
import { bridgeNames, ServerAdapter } from '@ailura/nestjs-hono-adapter';
import { request, startProbe } from '#test/probe';
import type { Probe } from '#test/probe';

import { inertiaModule } from './fixture.ts';

const INERTIA = { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' };
const OK = 200;
const CREATED = 201;
const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const FORBIDDEN = 403;
const CONFLICT = 409;

const CSRF_SESSION = 'csrf';
const FLASH_SESSION = 'flash';
const VALIDATION_SESSION = 'validation';

const tokenOf = (setCookie: string | null): string | undefined => {
  if (setCookie === null) return undefined;
  const match = /XSRF-TOKEN=(?<token>[^;]+)/u.exec(setCookie);
  if (match === null) return undefined;
  const { groups } = match;
  return groups === undefined ? undefined : groups.token;
};

const csrfToken = async (probe: Probe): Promise<string> => {
  const response = await request(probe, '/csrf', {
    headers: { 'x-test-session': CSRF_SESSION },
  });
  expect(response.status).toBe(OK);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toContain('XSRF-TOKEN=');
  const token = tokenOf(cookie);
  if (token === undefined) throw new Error('The CSRF cookie did not carry a token.');
  return token;
};

const submitCsrf = async (probe: Probe, token: string): Promise<number> => {
  const response = await request(probe, '/csrf', {
    headers: {
      cookie: `XSRF-TOKEN=${token}`,
      'x-test-session': CSRF_SESSION,
      'x-xsrf-token': token,
    },
    method: 'POST',
  });
  return response.status;
};

const probeOf = (): ReturnType<typeof startProbe> =>
  startProbe({ mode: 'in-process', module: inertiaModule() });

const headers = (extra: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { 'X-Inertia': 'true', 'X-Inertia-Version': 'v1' };
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

test('the page object carries merge, scroll and history metadata', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', { headers: INERTIA });
    expect(response.body).toMatchObject({
      clearHistory: true,
      deepMergeProps: ['deep'],
      matchPropsOn: { merged: 'id', 'scroll.data': 'id' },
      mergeProps: ['merged', 'scroll.data'],
      prependProps: ['prepended'],
      props: {
        always: 'always',
        deep: { nested: 1 },
        merged: [{ id: 1 }],
        prepended: [1],
        scroll: { currentPage: 1, data: [{ id: 1 }], nextPage: 2 },
      },
      scrollProps: {
        scroll: {
          currentPage: 1,
          nextPage: 2,
          pageName: 'page',
          reset: false,
        },
      },
    });
    expect(response.body).not.toHaveProperty('props.optional');
  } finally {
    await probe.close();
  }
});

test('an optional prop resolves only when requested and always resolves on every pass', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'optional',
      }),
    });
    expect(response.body).toMatchObject({ props: { always: 'always', optional: 'optional' } });
    expect(response.body).not.toHaveProperty('props.merged');
  } finally {
    await probe.close();
  }
});

test('a reset scroll prop is unlabeled and marked for reset', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'scroll',
        'X-Inertia-Reset': 'scroll',
      }),
    });
    expect(response.body).toMatchObject({ scrollProps: { scroll: { reset: true } } });
    expect(response.body).not.toHaveProperty('mergeProps');
  } finally {
    await probe.close();
  }
});

test('the merge intent prepends rather than appends', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/props', {
      headers: headers({
        'X-Inertia-Infinite-Scroll-Merge-Intent': 'prepend',
        'X-Inertia-Partial-Component': 'Props/Index',
        'X-Inertia-Partial-Data': 'scroll',
      }),
    });
    expect(response.body).toMatchObject({ prependProps: ['scroll.data'] });
  } finally {
    await probe.close();
  }
});

test('encryptHistory is emitted when the action asks for it', async () => {
  const probe = await probeOf();
  try {
    const response = await request(probe, '/encrypt', { headers: INERTIA });
    expect(response.body).toMatchObject({ encryptHistory: true });
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
