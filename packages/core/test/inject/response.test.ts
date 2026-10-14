import { expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';

import { HttpStatus } from '@nestjs/common';

import type { InjectCookie, InjectResponse } from '#adapter/index';
import { ANSWER_COOKIE, OTHER_COOKIE, app, registerApplication } from './support.ts';

registerApplication();

const readAll = async (stream: Readable): Promise<string> => {
  const parts: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8');
};

const firstCookie = (answer: InjectResponse): InjectCookie => {
  const [cookie] = answer.cookies;
  if (cookie === undefined) throw new Error('the answer carried no cookie');
  return cookie;
};

test('reports the answer the way light-my-request reports one', async () => {
  const application = await app();
  const answer = await application.inject('/text');
  expect(answer.statusCode).toBe(HttpStatus.OK);
  expect(answer.statusMessage).toBe('');
  expect(answer.payload).toBe('plain');
  expect(answer.body).toBe('plain');
  expect(answer.rawPayload.equals(Buffer.from('plain'))).toBe(true);
  expect(await readAll(answer.stream())).toBe('plain');
});

test('reports set-cookie as a list and parses the cookies', async () => {
  const application = await app();
  const answer = await application.inject('/cookie');
  expect(answer.headers['set-cookie']).toEqual([ANSWER_COOKIE]);
  expect(typeof answer.headers['content-type']).toBe('string');
  const cookie = firstCookie(answer);
  expect(cookie.name).toBe('session');
  expect(cookie.value).toBe('abc');
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.path).toBe('/');
});

test('keeps two appended cookies as two set-cookie headers', async () => {
  const application = await app();
  const answer = await application.inject('/cookies');
  expect(answer.headers['set-cookie']).toEqual([ANSWER_COOKIE, OTHER_COOKIE]);
  expect(answer.cookies.map((cookie) => cookie.name)).toEqual(['session', 'theme']);
});
