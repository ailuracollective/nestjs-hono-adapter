/**
 * The request half of the bridge: what a Hono context looks
 * like to a Nest handler.
 *
 * Nest reads a request as a bag of properties rather than
 * through an interface, so this is the one place the Web
 * request is translated into that bag, and the forwarded
 * headers are read here rather than by the caller.
 *
 * Nothing here reaches Node at runtime. The one Node type is
 * erased when the code is compiled, which is what keeps this
 * half clear of a value import from `node:`.
 */
import type { IncomingMessage } from 'node:http';

import type { NestContext } from './context.ts';
import { parseQuery } from './query.ts';
import type { ParsedQuery } from './query.ts';

/** The header a proxy sets with the protocol it received. */
const FORWARDED_PROTO = 'x-forwarded-proto';

/** The header a proxy sets with the host it received. */
const FORWARDED_HOST = 'x-forwarded-host';

/** The header a proxy sets with the address it received from. */
const FORWARDED_FOR = 'x-forwarded-for';

/**
 * The request properties Nest's core reads. Every property is
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
 * Continues to whatever handles the request next. The adapter
 * contract types it as returning `void` while Hono returns a
 * promise, so it is kept as `unknown` and the result ignored.
 */
type NextHandler = () => unknown;

/**
 * A handler as Nest registers it: the route proxy, a middleware
 * or the not-found proxy all share this shape.
 */
type NestHandler = (
  request: NestRequest,
  response: NestContext,
  next: NextHandler,
) => unknown;

/** How much of a proxy's word the deployment believes. */
interface RequestOptions {
  readonly trustProxy: boolean;
}

/** What the forwarded headers of one request said. */
interface Forwarded {
  readonly addresses: string[];
  readonly hosts: string[];
  readonly protocols: string[];
}

/**
 * Reads one forwarded header as the list it is: a proxy may
 * append to it, and the first entry is the one closest to the
 * client.
 */
function forwarded(
  context: NestContext,
  name: string,
): string[] {
  const header = context.req.header(name);
  if (header === undefined) {
    return [];
  }
  return header
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

/**
 * Reads a forwarded header only when the deployment says a
 * proxy sets it: a client that can write it can claim any
 * address it likes.
 */
function trustedValues(
  context: NestContext,
  name: string,
  trustProxy: boolean,
): string[] {
  if (!trustProxy) {
    return [];
  }
  return forwarded(context, name);
}

function forwardedValues(
  context: NestContext,
  options: RequestOptions,
): Forwarded {
  const { trustProxy } = options;
  return {
    addresses: trustedValues(
      context,
      FORWARDED_FOR,
      trustProxy,
    ),
    hosts: trustedValues(context, FORWARDED_HOST, trustProxy),
    protocols: trustedValues(
      context,
      FORWARDED_PROTO,
      trustProxy,
    ),
  };
}

/**
 * Maps a Hono context onto the request object Nest expects.
 *
 * Nest reads the request as a bag of properties rather than
 * through an interface, so this is the single place where the
 * Web request is translated into that bag.
 */
function toNestRequest(
  context: NestContext,
  options: RequestOptions,
): NestRequest {
  const target = new URL(context.req.url);
  const route = `${target.pathname}${target.search}`;
  const { incoming } = context.env;
  const values = forwardedValues(context, options);
  const [forwardedProtocol] = values.protocols;
  const scheme =
    forwardedProtocol ?? target.protocol.replace(':', '');
  const [host] = values.hosts;
  const [address] = values.addresses;
  return {
    body: undefined,
    files: undefined,
    headers: context.req.header(),
    hostname: host ?? target.hostname,
    hosts: {},
    ip: address ?? incoming.socket.remoteAddress,
    ips: values.addresses,
    method: context.req.method,
    originalUrl: route,
    params: context.req.param(),
    path: target.pathname,
    protocol: scheme,
    query: parseQuery(target.search),
    raw: incoming,
    rawBody: undefined,
    secure: scheme === 'https',
    session: undefined,
    socket: incoming.socket,
    url: route,
  };
}

export {
  toNestRequest,
  type NestHandler,
  type NestRequest,
  type NextHandler,
  type RequestOptions,
};
