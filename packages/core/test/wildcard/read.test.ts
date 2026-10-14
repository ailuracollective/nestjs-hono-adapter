import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';
import {
  FILES_PATH,
  TREE_PATH,
  USERS_PATH,
  WILDCARD_PROBE,
} from '#adapter-test/wildcard-fixture';

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
    expect(response.body).toStrictEqual({ byStar: 'a/b.txt' });
  } finally {
    await probe.close();
  }
});

test('a wildcard that matched nothing reads as empty', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
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
    const response = await request(probe, '/nothing/here');
    expect(response.status).toBe(HttpStatus.NOT_FOUND);
  } finally {
    await probe.close();
  }
});

test('a wildcard carrying a malformed escape is a bad request', async () => {
  const probe = await startProbe(WILDCARD_PROBE);
  try {
    const response = await request(probe, `${TREE_PATH}/%FF`);
    expect(response.status).toBe(HttpStatus.BAD_REQUEST);
  } finally {
    await probe.close();
  }
});
