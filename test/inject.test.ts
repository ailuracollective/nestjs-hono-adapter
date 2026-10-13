/**
 * `inject()` — the in-process request entry point.
 *
 * A suite that moved off `@nestjs/platform-fastify` reaches its
 * routes through `app.inject()` without binding a port. These
 * cases pin down the two call forms, the options a call may
 * name, the shape of the answer, and the options refused rather
 * than ignored.
 */

import { afterAll, beforeAll, expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpStatus,
  Module,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { fetchServer } from '../packages/core/src/servers/fetch.ts';
import { ServerAdapter } from '../packages/core/src/index.ts';
import type {
  InjectCookie,
  InjectResponse,
  NestContext,
  NestHonoApplication,
  NestRequest,
} from '../packages/core/src/index.ts';

/** The header a case sends and reads back. */
const GIVEN_HEADER = 'x-given';

/** The Cookie header a case's cookies are serialised into. */
const SENT_COOKIE = 'session=abc';

/** The `set-cookie` value the cookie route answers with. */
const ANSWER_COOKIE =
  'session=abc; Path=/; HttpOnly; SameSite=Lax';

/** The second cookie a route appends after the first. */
const OTHER_COOKIE = 'theme=dark; Path=/';

/** A controller with one route per behaviour `inject()` has. */
@Controller()
class InjectController {
  @Get('ping')
  public ping(): unknown {
    return { pong: true };
  }

  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  @Get('seen')
  public seen(@Req() source: NestRequest): unknown {
    return source.headers;
  }

  @Get('text')
  public text(): string {
    return 'plain';
  }

  @Get('cookie')
  @Header('set-cookie', ANSWER_COOKIE)
  public cookie(): unknown {
    return { ok: true };
  }

  @Get('cookies')
  public cookies(
    @Res({ passthrough: true }) response: NestContext,
  ): unknown {
    response.header('set-cookie', ANSWER_COOKIE);
    response.header('set-cookie', OTHER_COOKIE, {
      append: true,
    });
    return { ok: true };
  }

  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }
}

@Module({ controllers: [InjectController] })
class InjectModule {}

/**
 * The application under test, initialized but never listening.
 *
 * It is built through `NestFactory.create`, which hands the
 * application back behind the proxy `inject()` crosses: a case
 * that reaches a member through it is the case that proves the
 * proxy forwards this one.
 */
async function build(): Promise<NestHonoApplication> {
  const created = await NestFactory.create<NestHonoApplication>(
    InjectModule,
    new ServerAdapter({ transport: fetchServer() }),
    { logger: false },
  );
  await created.init();
  return created;
}

/** The one application every case asks for, once it is built. */
const state: { started?: Promise<NestHonoApplication> } = {};

/** The application, built on the first case that asks for it. */
function app(): Promise<NestHonoApplication> {
  state.started ??= build();
  return state.started;
}

/** Builds the application before the first case asks for it. */
beforeAll(async () => {
  await app();
});

/**
 * Intentionally leaves the application open to avoid disrupting
 * other applications served in the same test process.
 */
afterAll(() => {
  // The application is left open: closing one in a process that is
  // serving another costs the neighbours their answers.
});

/** The bytes a stream yields, read to the end. */
async function readAll(stream: Readable): Promise<string> {
  const parts: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString('utf8');
}

/**
 * The first cookie of an answer, which every case expects one
 * of.
 */
function firstCookie(answer: InjectResponse): InjectCookie {
  const [cookie] = answer.cookies;
  if (cookie === undefined) {
    throw new Error('the answer carried no cookie');
  }
  return cookie;
}

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

test('reports the answer the way light-my-request reports one', async () => {
  const application = await app();
  const answer = await application.inject('/text');
  expect(answer.statusCode).toBe(HttpStatus.OK);
  expect(answer.statusMessage).toBe('');
  expect(answer.payload).toBe('plain');
  expect(answer.body).toBe('plain');
  expect(answer.rawPayload.equals(Buffer.from('plain'))).toBe(
    true,
  );
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
  expect(answer.headers['set-cookie']).toEqual([
    ANSWER_COOKIE,
    OTHER_COOKIE,
  ]);
  expect(answer.cookies.map((cookie) => cookie.name)).toEqual([
    'session',
    'theme',
  ]);
});

test('answers a thrown HttpException as Nest does', async () => {
  const application = await app();
  const answer = await application.inject('/boom');
  const body: unknown = answer.json();
  expect(answer.statusCode).toBe(HttpStatus.FORBIDDEN);
  expect(body).toMatchObject({
    message: 'nope',
    statusCode: HttpStatus.FORBIDDEN,
  });
});

test('answers through the adapter itself, not only the proxy', async () => {
  const application = await app();
  const answer = await application
    .getHttpAdapter()
    .inject({ url: '/ping' });
  const body: unknown = answer.json();
  expect(body).toEqual({ pong: true });
});

test('refuses an option it cannot honour', async () => {
  const application = await app();
  let refusal = '';
  try {
    await application.inject({
      remoteAddress: '127.0.0.1',
      url: '/ping',
    });
  } catch (error) {
    if (error instanceof Error) {
      refusal = error.message;
    }
  }
  expect(refusal).toContain('remoteAddress');
});
