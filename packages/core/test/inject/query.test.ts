import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { app, registerApplication } from './support.ts';

registerApplication();

test.each([
  '/query?look=1',
  'query?look=1',
  './query?look=1#fragment',
  'https://example.test/query?look=1#fragment',
])('resolves %s before appending a query', async (url) => {
  const application = await app();
  const answer = await application.inject({
    query: { added: '2' },
    url,
  });
  expect(answer.statusCode).toBe(HttpStatus.OK);
  const body: unknown = answer.json();
  expect(body).toEqual({ added: '2', look: '1' });
});

test('sends a query given as a record', async () => {
  const application = await app();
  const answer = await application.inject({
    query: { look: '1', many: '2' },
    url: '/query',
  });
  const body: unknown = answer.json();
  expect(body).toEqual({ look: '1', many: '2' });
});

test('sends a query given as a string', async () => {
  const application = await app();
  const answer = await application.inject({
    query: 'look=1',
    url: '/query',
  });
  const body: unknown = answer.json();
  expect(body).toEqual({ look: '1' });
});
