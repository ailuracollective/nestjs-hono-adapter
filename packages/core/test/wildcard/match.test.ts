import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { request, startProbe } from '#test/probe';
import {
  DIRS_PATH,
  FILES_PATH,
  TREE_PATH,
  WILDCARD_PROBE,
} from '#adapter-test/wildcard-fixture';

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
    expect(response.body).toStrictEqual({ params: {} });
  } finally {
    await probe.close();
  }
});
