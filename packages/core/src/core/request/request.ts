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

type RequestHolder = Record<symbol, RequestBag | undefined>;

class RequestBag implements NestRequest {
  public body: unknown;

  public file: unknown;

  public files: Record<string, unknown> | readonly unknown[] | undefined;

  public rawBody: Buffer | undefined;

  public session: unknown;

  private readonly state: BagState;

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
