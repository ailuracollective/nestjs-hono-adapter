import type { NestContext } from './context.ts';

/**
 * How much of a proxy's word the deployment believes: `false`
 * none of it, `true` the whole chain, a hop count that many
 * addresses from the right, a list the addresses it names — the
 * levels Fastify reads from proxy-addr.
 */
type TrustProxy = boolean | number | string | readonly string[];

/** The header a proxy sets with the protocol it received. */
const FORWARDED_PROTO = 'x-forwarded-proto';

/** The header a proxy sets with the host it received. */
const FORWARDED_HOST = 'x-forwarded-host';

/** The header a proxy sets with the address it received from. */
const FORWARDED_FOR = 'x-forwarded-for';

/** What the forwarded headers of one request said. */
interface Forwarded {
  readonly addresses: string[];
  readonly hosts: string[];
  readonly protocols: string[];
}

/** How much of a proxy's word the deployment believes. */
interface RequestOptions {
  readonly trustProxy: TrustProxy;
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
 * the last hop in it: read from the right, so the nearest
 * address is part of what a deployment may name.
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
 * way proxy-addr reads it: a hop count trusts that many
 * addresses from the right — the socket's own side — and
 * answers the first past them; a list walks from the right past
 * every address it names, socket included; `true` trusts the
 * whole chain, so the leftmost address is the client's; `false`
 * trusts nothing the chain says.
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

export {
  addressOf,
  forwardedValues,
  type Forwarded,
  type RequestOptions,
  type TrustProxy,
};
