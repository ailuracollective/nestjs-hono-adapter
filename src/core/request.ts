import type { IncomingMessage } from 'node:http';

import type { NestContext } from './context.ts';
import { addressOf, forwardedValues } from './forwarded.ts';
import type { Forwarded, RequestOptions } from './forwarded.ts';
import { paramsOf } from './params.ts';
import { parseQuery } from './query.ts';
import type { ParsedQuery } from './query.ts';
import { tuneableSocket } from './socket.ts';

/**
 * The request properties Nest's core reads. Every one is
 * declared, and the ones that can legitimately be absent are
 * written as `| undefined`, so `exactOptionalPropertyTypes`
 * cannot hide a field that was never populated.
 */
interface NestRequest {
  method: string;
  url: string;
  originalUrl: string;
  path: string;
  hostname: string;
  protocol: string;
  secure: boolean;
  ip: string | undefined;
  ips: string[];
  headers: Record<string, string>;
  query: ParsedQuery;
  params: Record<string, string>;
  hosts: Record<string, string>;
  socket: IncomingMessage['socket'];
  raw: IncomingMessage;
  body: unknown;
  rawBody: Buffer | undefined;
  session: unknown;
  files: Record<string, unknown> | undefined;
}

/**
 * Continues to whatever handles the request next; kept as
 * `unknown` because the adapter contract types it as `void`
 * while Hono returns a promise.
 */
type NextHandler = () => unknown;

/**
 * A handler as Nest registers it: the route proxy, a middleware
 * and the not-found proxy share this shape.
 */
type NestHandler = (
  request: NestRequest,
  response: NestContext,
  next: NextHandler,
) => unknown;

/** The parts of the request URL a bag answers with. */
interface UrlParts {
  readonly hostname: string;
  readonly pathname: string;
  readonly protocol: string;
  readonly search: string;
  route: string | undefined;
}

/**
 * What a bag has not built yet, and the context it builds it
 * from. A bag is made for every request and read as a bag of
 * properties: measured over this project's own workload,
 * thirteen of the nineteen fields were never read, so each is
 * built the first time it is asked for.
 */
interface BagState {
  readonly context: NestContext;
  readonly options: RequestOptions;
  forwarded: Forwarded | undefined;
  headers: Record<string, string> | undefined;
  hostname: string | undefined;
  hosts: Record<string, string> | undefined;
  incoming: IncomingMessage | undefined;
  ip: string | undefined;
  method: string | undefined;
  params: Record<string, string> | undefined;
  protocol: string | undefined;
  query: ParsedQuery | undefined;
  url: UrlParts | undefined;
}

/**
 * The parts of the request URL, read once and kept. Still `new
 * URL` rather than a hand-written split: the normalisation it
 * applies to a path is behaviour this translation has always
 * had, and not a thing to change while turning something else
 * lazy.
 */
function urlPartsOf(state: BagState): UrlParts {
  const held = state.url;
  if (held !== undefined) {
    return held;
  }
  const target = new URL(state.context.req.url);
  const parts: UrlParts = {
    hostname: target.hostname,
    pathname: target.pathname,
    protocol: target.protocol.replace(':', ''),
    route: undefined,
    search: target.search,
  };
  state.url = parts;
  return parts;
}

/** The forwarded headers a deployment trusts, read once. */
function forwardedOf(state: BagState): Forwarded {
  const held = state.forwarded;
  if (held !== undefined) {
    return held;
  }
  const values = forwardedValues(state.context, state.options);
  state.forwarded = values;
  return values;
}

/**
 * The Node message the request arrived on, when there is one.
 * `undefined` is a real answer rather than a failure: a worker
 * calling `getHono().fetch()` with its own bindings arrives
 * without one, and the fields that can be answered without it
 * still are.
 */
function incomingOf(
  state: BagState,
): IncomingMessage | undefined {
  const held = state.incoming;
  if (held !== undefined) {
    return held;
  }
  const incoming: IncomingMessage | undefined =
    state.context.env?.incoming;
  state.incoming = incoming;
  return incoming;
}

/**
 * The Node message, for the two fields Nest types as always
 * present. Reading one without a message is the caller reaching
 * past what the request carries, so the absence is named here
 * rather than left as a `TypeError` from a property read.
 */
function required(state: BagState): IncomingMessage {
  const incoming = incomingOf(state);
  if (incoming === undefined) {
    throw new TypeError(
      'the request arrived without a Node message, so this field has nothing to read',
    );
  }
  return incoming;
}

/**
 * The request object Nest expects. The four fields the adapter
 * itself writes are own properties, so `body`, `files` and
 * `rawBody` stay assignable; everything else is an accessor on
 * the prototype, never a property defined for each request,
 * which was measured at 285 ns and would cost more than the
 * work it saves.
 */
class RequestBag implements NestRequest {
  public body: unknown;

  public files: Record<string, unknown> | undefined;

  public rawBody: Buffer | undefined;

  public session: unknown;

  private readonly state: BagState;

  public constructor(
    context: NestContext,
    options: RequestOptions,
  ) {
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
      protocol: undefined,
      query: undefined,
      url: undefined,
    };
    this.body = undefined;
    this.files = undefined;
    this.rawBody = undefined;
    this.session = undefined;
  }

  public get headers(): Record<string, string> {
    const { state } = this;
    state.headers ??= state.context.req.header();
    return state.headers;
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
    state.params ??= paramsOf(state.context);
    return state.params;
  }

  public get path(): string {
    return urlPartsOf(this.state).pathname;
  }

  public get protocol(): string {
    const { state } = this;
    if (state.protocol === undefined) {
      const [forwardedProtocol] = forwardedOf(state).protocols;
      state.protocol =
        forwardedProtocol ?? urlPartsOf(state).protocol;
    }
    return state.protocol;
  }

  public get query(): ParsedQuery {
    const { state } = this;
    state.query ??= parseQuery(urlPartsOf(state).search);
    return state.query;
  }

  public get raw(): IncomingMessage {
    return required(this.state);
  }

  public get secure(): boolean {
    return this.protocol === 'https';
  }

  public get socket(): IncomingMessage['socket'] {
    return tuneableSocket(required(this.state).socket);
  }

  public get url(): string {
    return this.originalUrl;
  }
}

/**
 * Maps a Hono context onto the request object Nest expects.
 * Nest reads the request as a bag of properties rather than
 * through an interface, so this is the single place the Web
 * request is translated into that bag.
 */
function toNestRequest(
  context: NestContext,
  options: RequestOptions,
): NestRequest {
  return new RequestBag(context, options);
}

export type {
  RequestOptions,
  TrustProxy,
} from './forwarded.ts';

export {
  toNestRequest,
  type NestHandler,
  type NestRequest,
  type NextHandler,
};
