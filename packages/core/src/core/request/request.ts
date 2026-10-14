import type { IncomingMessage } from 'node:http';

import type { NestContext } from '#adapter/core/context';
import type {
  Incoming,
  Socket,
} from '#adapter/core/ports/bindings';
import { tuneableSocket } from '#adapter/core/server/socket';
import {
  forwardedOf,
  incomingOf,
  required,
  urlPartsOf,
} from './bag-state.ts';
import type { BagState } from './bag-state.ts';
import { addressOf } from './forwarded.ts';
import type { RequestOptions } from './forwarded.ts';
import { paramsOf } from './params.ts';
import { parseQuery } from './query/index.ts';
import type { ParsedQuery } from './query/index.ts';
import type { NestRequest } from './types.ts';

/** The request object Nest expects. */
class RequestBag implements NestRequest {
  /** The parsed request body. */
  public body: unknown;

  /** The single upload an interceptor stored. */
  public file: unknown;

  /** The uploads an interceptor stored. */
  public files:
    | Record<string, unknown>
    | readonly unknown[]
    | undefined;

  /** The raw request body, when kept. */
  public rawBody: Buffer | undefined;

  /** The session Nest attached. */
  public session: unknown;

  /** The fields this bag builds on demand. */
  private readonly state: BagState;

  /** Builds the bag for one request. */
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
    this.file = undefined;
    this.files = undefined;
    this.rawBody = undefined;
    this.session = undefined;
  }

  /** The request headers. */
  public get headers(): Record<string, string> {
    const { state } = this;
    state.headers ??= state.context.req.header();
    return state.headers;
  }

  /** The host the request names. */
  public get hostname(): string {
    const { state } = this;
    if (state.hostname === undefined) {
      const [host] = forwardedOf(state).hosts;
      state.hostname = host ?? urlPartsOf(state).hostname;
    }
    return state.hostname;
  }

  /** The host parameters. */
  public get hosts(): Record<string, string> {
    const { state } = this;
    state.hosts ??= {};
    return state.hosts;
  }

  /** The client address. */
  public get ip(): string | undefined {
    const { state } = this;
    state.ip ??= addressOf(
      forwardedOf(state).addresses,
      incomingOf(state)?.socket.remoteAddress,
      state.options.trustProxy,
    );
    return state.ip;
  }

  /** The addresses in the forwarding chain. */
  public get ips(): string[] {
    return forwardedOf(this.state).addresses;
  }

  /** The request method. */
  public get method(): string {
    const { state } = this;
    state.method ??= state.context.req.method;
    return state.method;
  }

  /** The original request URL. */
  public get originalUrl(): string {
    const parts = urlPartsOf(this.state);
    parts.route ??= `${parts.pathname}${parts.search}`;
    return parts.route;
  }

  /** The route parameters. */
  public get params(): Record<string, string> {
    const { state } = this;
    state.params ??= paramsOf(state.context);
    return state.params;
  }

  /** The request path. */
  public get path(): string {
    return urlPartsOf(this.state).pathname;
  }

  /** The request protocol. */
  public get protocol(): string {
    const { state } = this;
    if (state.protocol === undefined) {
      const [forwardedProtocol] = forwardedOf(state).protocols;
      state.protocol =
        forwardedProtocol ?? urlPartsOf(state).protocol;
    }
    return state.protocol;
  }

  /** The parsed query string. */
  public get query(): ParsedQuery {
    const { state } = this;
    state.query ??= parseQuery(urlPartsOf(state).search);
    return state.query;
  }

  /** The Node message the request arrived on. */
  public get raw(): IncomingMessage & Incoming {
    return required(this.state) as IncomingMessage & Incoming;
  }

  /** Whether the request is secure. */
  public get secure(): boolean {
    return this.protocol === 'https';
  }

  /** The socket the request arrived on. */
  public get socket(): IncomingMessage['socket'] & Socket {
    return tuneableSocket(
      required(this.state).socket,
    ) as IncomingMessage['socket'] & Socket;
  }

  /** The request URL. */
  public get url(): string {
    return this.originalUrl;
  }
}

/** Maps a Hono context onto the request object Nest expects. */
const toNestRequest = (
  context: NestContext,
  options: RequestOptions,
): NestRequest => new RequestBag(context, options);

export { toNestRequest };
export type {
  RequestOptions,
  TrustProxy,
} from './forwarded.ts';
export type {
  NestHandler,
  NestRequest,
  NextHandler,
} from './types.ts';
