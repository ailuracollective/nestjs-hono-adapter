import '#inertia/register';

import { expect } from 'bun:test';
import type { Probe } from '#test/probe';
import { request, startProbe } from '#test/probe';

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

export {
  CONFLICT,
  CREATED,
  CSRF_SESSION,
  FLASH_SESSION,
  FORBIDDEN,
  FOUND,
  INERTIA,
  MOVED_PERMANENTLY,
  OK,
  SEE_OTHER,
  VALIDATION_SESSION,
  csrfToken,
  deleteStatus,
  headers,
  pageComponent,
  partialHeaders,
  probeOf,
  submitCsrf,
  tokenOf,
};
