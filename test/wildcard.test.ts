/**
 * The wildcard cases: every one is a sentence about what a
 * handler is given for the part of a path the router matched
 * and then dropped. The routes live in `wildcard-fixture.ts`
 * and the probe that serves them in `probe.ts`.
 */
import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from './probe.ts';
import {
  DIRS_PATH,
  FILES_PATH,
  TREE_PATH,
  USERS_PATH,
  WILDCARD_PROBE,
} from './wildcard-fixture.ts';

test('a wildcard at the end of a path takes the rest of it', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${TREE_PATH}/reports/2024/q1.csv`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': 'reports/2024/q1.csv' },
    });
  } finally {
    await probe.close();
  }
});

test('a wildcard between siblings stops where its sibling begins', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${DIRS_PATH}/reports/meta`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    // The sibling after the wildcard is not part of it, which
    // is the difference between `reports` and `reports/meta`.
    expect(response.body).toStrictEqual({
      params: { '*': 'reports' },
    });
  } finally {
    await probe.close();
  }
});

test('a route with no wildcard in it gains no key', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${FILES_PATH}/plain`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    // Absent rather than empty: a route that matched nothing
    // of that kind has not matched an empty one.
    expect(response.body).toStrictEqual({ params: {} });
  } finally {
    await probe.close();
  }
});

test('the wildcard is decoded the way any other parameter is', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${TREE_PATH}/caf%C3%A9/r%C3%A9sum%C3%A9`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': 'café/résumé' },
    });
  } finally {
    await probe.close();
  }
});

test('a named parameter beside a wildcard still resolves', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${USERS_PATH}/7/a/b.txt`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': 'a/b.txt', id: '7' },
    });
  } finally {
    await probe.close();
  }
});

test('the wildcard is read under the key its route writes it as', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(
      probe,
      `${FILES_PATH}/spellings/a/b.txt`,
    );
    expect(response.status).toBe(HttpStatus.OK);
    // The name is lost before Hono ever sees the route, and a
    // numeric key belongs to a dialect this Nest no longer
    // speaks, so `@Param('*')` is the only one of the three
    // that resolves. The other two are absent rather than
    // empty because the handler was given nothing at all.
    expect(response.body).toStrictEqual({ byStar: 'a/b.txt' });
  } finally {
    await probe.close();
  }
});

test('a wildcard that matched nothing reads as empty', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    // Hono routes the bare prefix to the wildcard rather than
    // refusing it, so the handler is reached and is told the
    // wildcard took nothing rather than that it is not there.
    const response = await request(probe, TREE_PATH);
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      params: { '*': '' },
    });
  } finally {
    await probe.close();
  }
});

test('a request that reached no route is still refused', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    // The registered path only exists once a request reached
    // a route, so reading it for one that reached none is
    // what the not-found answer has to survive.
    const response = await request(probe, '/nothing/here');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});
