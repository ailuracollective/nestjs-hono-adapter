import { expect, test } from 'bun:test';
import {
  bridgeNames,
  discoverBridges,
} from '#adapter/compat/index';

import { request, startProbe } from '#test/probe';

import {
  graphQlModule,
  probeContext,
} from './graphql-fixture.ts';

/** The path Apollo answers on when the deployment named none. */
const PATH = '/graphql';

/** The status an answered operation carries. */
const OK = 200;

/** The status an unanswered path carries. */
const NOT_FOUND = 404;

/** The status a refused operation carries at least. */
const REFUSED = 400;

/** The status a failure carries no more than. */
const NOT_A_FAILURE = 500;

/** One GraphQL operation, as a JSON request body. */
const operation = (text: string): string =>
  JSON.stringify({ query: text });

test('the region finds the installed bridge package on its own', async () => {
  await discoverBridges();
  expect(bridgeNames()).toContain('graphql/apollo');
});

/** The request one GraphQL operation is sent with. */
const ask = (): RequestInit => ({
  body: operation('{ echo }'),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});

/**
 * A GET carries no body, so the operation rides in the query
 * string. Apollo reads two headers on that path: the content
 * type, which it only accepts as `application/json`, and
 * `accept`, which it negotiates the answer's type from.
 */
const get = (): RequestInit => ({
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
  },
  method: 'GET',
});

/** A POST carrying whatever operation the case names. */
const post = (text: string): RequestInit => ({
  body: operation(text),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});

test('the stock Apollo driver answers on Hono', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(probe, PATH, ask());
    expect(response.status).toBe(OK);
    expect(response.body).toStrictEqual({
      data: { echo: 'POST' },
    });
  } finally {
    await probe.close();
  }
});

test('a named path is the path that answers', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule({ path: '/schema' }),
  });
  try {
    const response = await request(probe, '/schema', ask());
    expect(response.status).toBe(OK);
  } finally {
    await probe.close();
  }
});

test('the endpoint does not answer on the default path then', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule({ path: '/schema' }),
  });
  try {
    const response = await request(probe, PATH, ask());
    expect(response.status).toBe(NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a context factory is called with req and res, and answers', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule({ context: probeContext }),
  });
  try {
    const response = await request(probe, PATH, ask());
    expect(response.body).toStrictEqual({
      data: { echo: 'sighted' },
    });
  } finally {
    await probe.close();
  }
});

test('with no factory, the base context carries req', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(probe, PATH, ask());
    expect(response.body).toStrictEqual({
      data: { echo: 'POST' },
    });
  } finally {
    await probe.close();
  }
});

test('a malformed operation is answered, not thrown', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(probe, PATH, post('{'));
    expect(response.status).toBeGreaterThanOrEqual(REFUSED);
  } finally {
    await probe.close();
  }
});

test('a GET carries no body and is answered', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(
      probe,
      `${PATH}?query={echo}`,
      get(),
    );
    expect(response.status).toBe(OK);
    expect(response.body).toStrictEqual({
      data: { echo: 'GET' },
    });
  } finally {
    await probe.close();
  }
});

test('OPTIONS is answered on the endpoint', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(probe, PATH, {
      method: 'OPTIONS',
    });
    expect(response.status).toBeLessThan(NOT_A_FAILURE);
  } finally {
    await probe.close();
  }
});

test('the landing page answers on a GET that accepts HTML', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const response = await request(probe, PATH, {
      headers: { accept: 'text/html' },
      method: 'GET',
    });
    expect(response.status).toBe(OK);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toContain('GraphQL');
  } finally {
    await probe.close();
  }
});

test('the endpoint answers twice on one application', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: graphQlModule(),
  });
  try {
    const first = await request(probe, PATH, ask());
    const second = await request(probe, PATH, ask());
    expect(first.body).toStrictEqual(second.body);
  } finally {
    await probe.close();
  }
});
