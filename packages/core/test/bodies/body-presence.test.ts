import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { HttpException, HttpStatus } from '@nestjs/common';

import type { NestEnv } from '#adapter/core/context';
import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { Bindings } from '#adapter/core/ports/bindings';
import { declaresBody } from '#adapter/core/request/body/guards';
import { readBody } from '#adapter/core/request/body/index';
import { BODY_LIMIT } from './support.ts';

const HTTP2 = 2;

const nativeBindings = (version = 1): Bindings => {
  const incoming = new IncomingMessage(new Socket());
  incoming.httpVersionMajor = version;
  return { incoming, outgoing: new ServerResponse(incoming) };
};

const probe = async (raw: Request, bindings?: Bindings): Promise<boolean> => {
  let declared = false;
  const app = new Hono<NestEnv>();
  app.all('/', (context) => {
    declared = declaresBody(context);
    return context.body('');
  });
  const response = await app.fetch(raw, bindings);
  expect(response.status).toBe(HttpStatus.OK);
  return declared;
};

const unreadBody = (method = 'GET', headers?: RequestInit['headers']): Request => {
  const raw = new Request('http://localhost/', { headers, method });
  Object.defineProperty(raw, 'body', {
    get(): never {
      throw new Error('The empty HTTP/1 body must stay lazy.');
    },
  });
  return raw;
};

test.each(['GET', 'HEAD'])(
  'an empty native HTTP/1 %s does not materialise the Web body',
  async (method) => {
    expect(await probe(unreadBody(method), nativeBindings())).toBe(false);
  },
);

test.each(['content-length', 'transfer-encoding'])(
  '%s declares a body without materialising the Web request',
  async (name) => {
    const headers = { [name]: name === 'content-length' ? '0' : 'chunked' };
    expect(await probe(unreadBody('GET', headers), nativeBindings())).toBe(true);
  },
);

test('a consumed body remains declared even on native HTTP/1', async () => {
  const raw = unreadBody();
  Object.defineProperty(raw, 'bodyUsed', { value: true });
  expect(await probe(raw, nativeBindings())).toBe(true);
});

test.each([
  { bindings: undefined, name: 'fetch' },
  { bindings: { incoming: new RequestCarrier(undefined) }, name: 'synthetic carriers' },
  { bindings: nativeBindings(HTTP2), name: 'HTTP/2' },
])('$name retains unframed Web bodies', async ({ bindings }) => {
  const raw = new Request('http://localhost/');
  Object.defineProperty(raw, 'body', { value: new ReadableStream() });
  expect(await probe(raw, bindings)).toBe(true);
});

test.each([
  { encoding: 'identity', length: '100', status: HttpStatus.PAYLOAD_TOO_LARGE },
  { encoding: 'gzip', length: '1', status: HttpStatus.UNSUPPORTED_MEDIA_TYPE },
])(
  'a framed native GET retains body validation ($status)',
  async ({ encoding, length, status }) => {
    const app = new Hono<NestEnv>();
    app.onError(
      (exception) =>
        new Response('', {
          status:
            exception instanceof HttpException
              ? exception.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR,
        }),
    );
    app.get('/', async (context) => {
      await readBody(context, { bodyLimit: BODY_LIMIT, rawBody: false, skipMultipart: false });
      return context.body('');
    });
    const raw = unreadBody('GET', { 'content-encoding': encoding, 'content-length': length });
    const response = await app.fetch(raw, nativeBindings());
    expect(response.status).toBe(status);
  },
);
