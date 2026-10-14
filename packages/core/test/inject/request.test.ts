import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import {
  GIVEN_HEADER,
  SENT_COOKIE,
  app,
  registerApplication,
} from './support.ts';

registerApplication();

test('answers a route without listening', async () => {
  const application = await app();
  const answer = await application.inject({
    method: 'GET',
    url: '/ping',
  });
  const body: unknown = answer.json();
  expect(answer.statusCode).toBe(HttpStatus.OK);
  expect(body).toEqual({ pong: true });
});

test('defaults to GET when the call names no method', async () => {
  const application = await app();
  const answer = await application.inject({ url: '/ping' });
  const body: unknown = answer.json();
  expect(body).toEqual({ pong: true });
});

test.each([
  { method: 'GET', payload: { ignored: true }, url: '/ping' },
  { body: { ignored: true }, method: 'get', url: '/ping' },
  { method: 'HEAD', payload: { ignored: true }, url: '/ping' },
  { body: { ignored: true }, method: 'head', url: '/ping' },
])('ignores the body for $method', async (options) => {
  const application = await app();
  const answer = await application.inject(options);
  expect(answer.statusCode).toBe(HttpStatus.OK);
  if (options.method.toUpperCase() === 'HEAD') {
    expect(answer.body).toBe('');
  } else {
    const body: unknown = answer.json();
    expect(body).toEqual({ pong: true });
  }
});

test('reads the method out of the string form', async () => {
  const application = await app();
  const answer = await application.inject({
    payload: { said: 'hi' },
    url: 'POST /echo',
  });
  const body: unknown = answer.json();
  expect(answer.statusCode).toBe(HttpStatus.CREATED);
  expect(body).toEqual({ said: 'hi' });
});

test('takes the url as the object form', async () => {
  const application = await app();
  const answer = await application.inject({
    url: { pathname: '/query', query: { look: '1' } },
  });
  const body: unknown = answer.json();
  expect(body).toEqual({ look: '1' });
});

test('sends the headers and the cookies a call names', async () => {
  const application = await app();
  const answer = await application.inject({
    cookies: { session: 'abc' },
    headers: { [GIVEN_HEADER]: 'yes' },
    url: '/seen',
  });
  const body: unknown = answer.json();
  expect(body).toMatchObject({
    [GIVEN_HEADER]: 'yes',
    cookie: SENT_COOKIE,
  });
});
