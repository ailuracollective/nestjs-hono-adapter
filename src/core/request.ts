import type { IncomingMessage } from 'node:http';

import { routePath } from 'hono/route';

import type { NestContext } from './context.ts';
import { parseQuery } from './query.ts';
import type { ParsedQuery } from './query.ts';
import { tuneableSocket } from './socket.ts';

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
 * How much of a proxy's word the deployment believes. `false`
 * is none of it, `true` is the whole chain, a hop count trusts
 * that many addresses from the right, and a list trusts the
 * addresses it names — the levels Fastify reads from
 * proxy-addr.
 */
type TrustProxy = boolean | number | string | readonly string[];

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
  readonly trustProxy: TrustProxy;
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
      trustProxy !== false && trustProxy !== 0,
    ),
    hosts: trustedValues(
      context,
      FORWARDED_HOST,
      trustProxy !== false && trustProxy !== 0,
    ),
    protocols: trustedValues(
      context,
      FORWARDED_PROTO,
      trustProxy !== false && trustProxy !== 0,
    ),
  };
}

/**
 * The chain a proxy wrote, with the address the socket has of
 * the last hop in it: the list is read from the right, so the
 * nearest address is part of what a deployment may name.
 */
function chainOf(
  forwardedFor: readonly string[],
  socket: string | undefined,
): string[] {
  if (socket === undefined) {
    return [...forwardedFor];
  }
  return [...forwardedFor, socket];
}

/** The addresses a list of trusted names holds. */
function trustedOf(
  trust: string | readonly string[],
): Set<string> {
  if (typeof trust === 'string') {
    return new Set([trust]);
  }
  return new Set(trust);
}

/**
 * The first address, walking from the right, the list does not
 * name.
 */
function firstUntrusted(
  chain: readonly string[],
  trusted: ReadonlySet<string>,
): string | undefined {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const address = chain[index];
    if (address !== undefined && !trusted.has(address)) {
      return address;
    }
  }
  return undefined;
}

/**
 * The client address a trusted proxy chain reveals, read the
 * way proxy-addr reads it. A hop count trusts that many
 * addresses from the right — the socket's own side — and the
 * answer is the first address past them; a list walks from the
 * right past every address it names, socket included; `true`
 * trusts the whole chain, so the leftmost address is the
 * client's, and `false` trusts nothing the chain says.
 */
function addressOf(
  forwardedFor: readonly string[],
  socket: string | undefined,
  trustProxy: TrustProxy,
): string | undefined {
  if (trustProxy === false || forwardedFor.length === 0) {
    return socket;
  }
  if (trustProxy === true) {
    return forwardedFor[0];
  }
  if (typeof trustProxy === 'number') {
    const index = Math.max(0, forwardedFor.length - trustProxy);
    return forwardedFor[index] ?? socket;
  }
  return (
    firstUntrusted(
      chainOf(forwardedFor, socket),
      trustedOf(trustProxy),
    ) ?? forwardedFor[0]
  );
}

/** The characters that end a named parameter in a pattern. */
const PARAMETER_END = /[?{]/u;

/** The index a search of a string did not find. */
const MISSING = -1;

const TRAILING_SLASH = /\/$/u;

/**
 * The pattern a request matched, with its named parameters
 * filled in by the values the route captured. A named parameter
 * the route did not capture is left as it was written, which
 * reads as a prefix the path cannot match, and the caller
 * treats that as no capture rather than a wrong one.
 */
function resolvedPrefixOf(
  pattern: string,
  params: Record<string, string>,
): string {
  const resolved = pattern.split('/').map((segment) => {
    if (!segment.startsWith(':')) {
      return segment;
    }
    const name = segment.slice(1).replace(PARAMETER_END, '');
    return params[name] ?? segment;
  });
  return resolved.join('/');
}

/**
 * Whether the path holds the prefix and, when the wildcard has
 * one, the suffix it stands between.
 */
function surrounds(
  path: string,
  prefix: string,
  suffix: string,
): boolean {
  if (!path.startsWith(prefix)) {
    return false;
  }
  return suffix === '' || path.endsWith(suffix);
}

/** What lies between a prefix and a suffix of the path. */
function captureBetween(
  path: string,
  prefix: string,
  suffix: string,
): string {
  if (suffix === '') {
    return path.slice(prefix.length);
  }
  return path.slice(prefix.length, path.length - suffix.length);
}

/**
 * The text a wildcard stands for. The router matches the
 * wildcard without reporting what it stood for — it names the
 * pattern it matched, not the capture — so the capture is read
 * back out of the path: it is what lies between the part of the
 * pattern before the `*` and the part after it.
 */
/**
 * The wildcard a route matched when it matched the bare prefix.
 * Hono routes `/tree` to `/tree/*`, so the request reached this
 * route and the wildcard matched nothing, rather than nothing
 * matching. That is empty, not absent.
 */
function emptyTailOf(
  path: string,
  prefix: string,
): string | undefined {
  if (path === prefix.replace(TRAILING_SLASH, '')) {
    return '';
  }
  return undefined;
}

function wildcardOf(
  context: NestContext,
  params: Record<string, string>,
): string | undefined {
  const pattern = routePath(context);
  const wildcard = pattern.indexOf('*');
  if (wildcard === MISSING) {
    return undefined;
  }
  const { path } = context.req;
  const prefix = resolvedPrefixOf(
    pattern.slice(0, wildcard),
    params,
  );
  const suffix = pattern.slice(wildcard + 1);
  if (!surrounds(path, prefix, suffix)) {
    return emptyTailOf(path, prefix);
  }
  return captureBetween(path, prefix, suffix);
}

/**
 * The params a route captured. The wildcard is read under the
 * key the router answers it by — `*`, the same one Fastify uses
 * — and a path that matched none yields an empty bag.
 */
function paramsOf(
  context: NestContext,
): Record<string, string> {
  const params = context.req.param();
  const wildcard = wildcardOf(context, params);
  if (wildcard !== undefined) {
    params['*'] = decodeURIComponent(wildcard);
  }
  return params;
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
  return {
    body: undefined,
    files: undefined,
    headers: context.req.header(),
    hostname: host ?? target.hostname,
    hosts: {},
    ip: addressOf(
      values.addresses,
      incoming.socket.remoteAddress,
      options.trustProxy,
    ),
    ips: values.addresses,
    method: context.req.method,
    originalUrl: route,
    params: paramsOf(context),
    path: target.pathname,
    protocol: scheme,
    query: parseQuery(target.search),
    raw: incoming,
    rawBody: undefined,
    secure: scheme === 'https',
    session: undefined,
    socket: tuneableSocket(incoming.socket),
    url: route,
  };
}

export {
  toNestRequest,
  type NestHandler,
  type NestRequest,
  type NextHandler,
  type RequestOptions,
  type TrustProxy,
};
