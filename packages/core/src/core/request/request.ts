import { Readable } from 'node:stream';

import type { IncomingMessage } from 'node:http';

import type { NestContext } from '#adapter/core/context';
import type { Incoming, Socket } from '#adapter/core/ports/bindings';
import { tuneableSocket } from '#adapter/core/server/socket';
import { forwardedOf, incomingOf, urlPartsOf } from './bag-state.ts';
import type { BagState } from './bag-state.ts';
import { addressOf } from './forwarded.ts';
import type { RequestOptions } from './forwarded.ts';
import { paramsOf } from './params.ts';
import { parseQuery } from './query/index.ts';
import type { ParsedQuery } from './query/index.ts';
import type { NestRequest } from './types.ts';

const REQUEST = Symbol('nestRequest');

// Express middleware that streams the body itself (`busboy` behind `graphql-upload`/`multer`)
// reads the request as a Node stream. The body the transport carries is the standard
// `Request.body`, so the stream is built from it — the same `Readable.fromWeb` the multipart
// package uses — and works on every transport that has one, Node and Bun alike.
const bodyStreamOf = (context: NestContext): Readable => {
  const { body } = context.req.raw;
  if (body === null) return Readable.from([]);
  return Readable.fromWeb(body);
};

const mediaTypeOf = (contentType: string): string =>
  (contentType.split(';', 1)[0] ?? '').trim().toLowerCase();

const matchesMediaType = (actual: string, wanted: string): boolean => {
  const candidate = wanted.trim().toLowerCase();
  if (candidate === '*/*') return true;
  if (candidate.endsWith('/*')) return actual.startsWith(candidate.replace('*', ''));
  if (candidate.startsWith('+')) return actual.endsWith(candidate);
  if (candidate === 'multipart') return actual.startsWith('multipart/');
  if (candidate === 'urlencoded') return actual === 'application/x-www-form-urlencoded';
  if (!candidate.includes('/')) {
    const subtype = actual.slice(actual.indexOf('/') + 1);
    return subtype === candidate || subtype.endsWith(`+${candidate}`);
  }
  return actual === candidate;
};

type RequestHolder = Record<symbol, RequestBag | undefined>;

class RequestBag implements NestRequest {
  public body: unknown;

  public file: unknown;

  public files: Record<string, unknown> | readonly unknown[] | undefined;

  public rawBody: Buffer | undefined;

  public session: unknown;

  private readonly state: BagState;

  private source: Readable | undefined;

  public constructor(context: NestContext, options: RequestOptions) {
    this.state = {
      context,
      forwarded: undefined,
      headers: undefined,
      hostname: undefined,
      hosts: undefined,
      incoming: undefined,
      ip: undefined,
      method: undefined,
      options,
      params: undefined,
      paramsAt: undefined,
      protocol: undefined,
      query: undefined,
      url: undefined,
    };
    this.body = undefined;
    this.file = undefined;
    this.files = undefined;
    this.rawBody = undefined;
    this.session = undefined;
  }

  public get headers(): Record<string, string> {
    const { state } = this;
    state.headers ??= state.context.req.header();
    return state.headers;
  }

  public is(type: string | readonly string[]): string | false {
    const contentType = this.headers['content-type'];
    if (contentType === undefined || contentType === '') return false;
    const actual = mediaTypeOf(contentType);
    const wanted = typeof type === 'string' ? [type] : type;
    for (const candidate of wanted) {
      if (matchesMediaType(actual, candidate)) return candidate;
    }
    return false;
  }

  public get(name: string): string | undefined {
    const wanted = name.toLowerCase();
    const { headers } = this;
    const exact = headers[wanted];
    if (exact !== undefined) return exact;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === wanted) return value;
    }
    return undefined;
  }

  public header(name: string): string | undefined {
    return this.get(name);
  }

  public get hostname(): string {
    const { state } = this;
    if (state.hostname === undefined) {
      const [host] = forwardedOf(state).hosts;
      state.hostname = host ?? urlPartsOf(state).hostname;
    }
    return state.hostname;
  }

  public get hosts(): Record<string, string> {
    const { state } = this;
    state.hosts ??= {};
    return state.hosts;
  }

  public set hosts(hosts: Record<string, string>) {
    this.state.hosts = hosts;
  }

  public get ip(): string | undefined {
    const { state } = this;
    state.ip ??= addressOf(
      forwardedOf(state).addresses,
      incomingOf(state)?.socket.remoteAddress,
      state.options.trustProxy,
    );
    return state.ip;
  }

  public get ips(): string[] {
    return forwardedOf(this.state).addresses;
  }

  public get method(): string {
    const { state } = this;
    state.method ??= state.context.req.method;
    return state.method;
  }

  public get originalUrl(): string {
    const parts = urlPartsOf(this.state);
    parts.route ??= `${parts.pathname}${parts.search}`;
    return parts.route;
  }

  public get params(): Record<string, string> {
    const { state } = this;
    const at = state.context.req.routeIndex;
    if (state.params === undefined || state.paramsAt !== at) {
      state.params = paramsOf(state.context);
      state.paramsAt = at;
    }
    return state.params;
  }

  public get path(): string {
    return urlPartsOf(this.state).pathname;
  }

  public get protocol(): string {
    const { state } = this;
    if (state.protocol === undefined) {
      const [forwardedProtocol] = forwardedOf(state).protocols;
      state.protocol = forwardedProtocol ?? urlPartsOf(state).protocol;
    }
    return state.protocol;
  }

  public get query(): ParsedQuery {
    const { state } = this;
    state.query ??= parseQuery(urlPartsOf(state).search);
    return state.query;
  }

  public get raw(): (IncomingMessage & Incoming) | undefined {
    return incomingOf(this.state) as (IncomingMessage & Incoming) | undefined;
  }

  // The adapter drains the carrier before an Express body-parser runs; `body-parser` asks
  // `on-finished`, which reads these flags, so mirroring the real state lets it stand down.
  public get complete(): boolean {
    return this.raw?.complete ?? true;
  }

  public get readable(): boolean {
    return this.raw?.readable ?? false;
  }

  // The Express request surface a body-streaming middleware reaches for. `graphql-upload` pipes the
  // request into `busboy`; on the adapter that is a `Readable` over the standard `Request.body`.
  // A body a middleware consumed this way is read back from `NestRequest.body` by the route.
  public get stream(): Readable {
    this.source ??= bodyStreamOf(this.state.context);
    return this.source;
  }

  // `graphql-upload` only treats the request's `close` as a disconnect when the body stream has not
  // ended; without this it read `undefined` and aborted every upload as "request disconnected".
  public get readableEnded(): boolean {
    return this.source?.readableEnded ?? false;
  }

  public pipe(
    destination: NodeJS.WritableStream,
    options?: { end?: boolean },
  ): NodeJS.WritableStream {
    return this.stream.pipe(destination, options);
  }

  public unpipe(destination?: NodeJS.WritableStream): this {
    this.stream.unpipe(destination);
    return this;
  }

  public resume(): this {
    this.stream.resume();
    return this;
  }

  public pause(): this {
    this.stream.pause();
    return this;
  }

  public on(event: string, listener: (...args: unknown[]) => void): this {
    this.stream.on(event, listener);
    return this;
  }

  public once(event: string, listener: (...args: unknown[]) => void): this {
    this.stream.once(event, listener);
    return this;
  }

  public get secure(): boolean {
    return this.protocol === 'https';
  }

  public get socket(): (IncomingMessage['socket'] & Socket) | undefined {
    const incoming = incomingOf(this.state);
    if (incoming === undefined) return undefined;
    return tuneableSocket(incoming.socket) as (IncomingMessage['socket'] & Socket) | undefined;
  }

  public get url(): string {
    return this.originalUrl;
  }
}

const toNestRequest = (context: NestContext, options: RequestOptions): NestRequest => {
  const holder = context as unknown as RequestHolder;
  const held = holder[REQUEST];
  if (held !== undefined) return held;
  const built = new RequestBag(context, options);
  holder[REQUEST] = built;
  return built;
};

export { toNestRequest };
export type { RequestOptions, TrustProxy } from './forwarded.ts';
export type { NestHandler, NestRequest, NextHandler } from './types.ts';
