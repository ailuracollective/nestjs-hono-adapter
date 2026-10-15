import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { MappedTypesFixture } from './cases/clients.ts';
import { withApp } from './support.ts';

const JSON_HEADERS = { 'content-type': 'application/json' };

test('a PartialType DTO is validated through the adapter', async () => {
  await withApp(MappedTypesFixture, async (probe) => {
    const answer = await probe.request('/things', {
      body: JSON.stringify({ name: 'kept' }),
      headers: JSON_HEADERS,
      method: 'POST',
    });

    expect(answer.status).toBe(HttpStatus.CREATED);
    expect(answer.body).toStrictEqual({ name: 'kept' });
  });
});

test('the adapter hands the pipe a body the DTO refuses', async () => {
  await withApp(MappedTypesFixture, async (probe) => {
    const answer = await probe.request('/things', {
      body: JSON.stringify({ name: 5 }),
      headers: JSON_HEADERS,
      method: 'POST',
    });

    expect(answer.status).toBe(HttpStatus.BAD_REQUEST);
  });
});
