import type { NestContext } from '#adapter/core/context';

type TrustProxy = boolean | number | string | readonly string[];

const FORWARDED_PROTO = 'x-forwarded-proto';

const FORWARDED_HOST = 'x-forwarded-host';

const FORWARDED_FOR = 'x-forwarded-for';

interface Forwarded {
  readonly addresses: string[];
  readonly hosts: string[];
  readonly protocols: string[];
}

interface RequestOptions {
  readonly trustProxy: TrustProxy;
}

const forwarded = (context: NestContext, name: string): string[] => {
  const header = context.req.header(name);
  if (header === undefined) return [];
  return header
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
};

const trustedValues = (context: NestContext, name: string, trustProxy: boolean): string[] => {
  if (!trustProxy) return [];
  return forwarded(context, name);
};

const forwardedValues = (context: NestContext, options: RequestOptions): Forwarded => {
  const { trustProxy } = options;
  return {
    addresses: trustedValues(context, FORWARDED_FOR, trustProxy !== false && trustProxy !== 0),
    hosts: trustedValues(context, FORWARDED_HOST, trustProxy !== false && trustProxy !== 0),
    protocols: trustedValues(context, FORWARDED_PROTO, trustProxy !== false && trustProxy !== 0),
  };
};

const chainOf = (forwardedFor: readonly string[], socket: string | undefined): string[] => {
  if (socket === undefined) return [...forwardedFor];
  return [...forwardedFor, socket];
};

const trustedOf = (trust: string | readonly string[]): Set<string> => {
  if (typeof trust === 'string') return new Set([trust]);
  return new Set(trust);
};

const firstUntrusted = (
  chain: readonly string[],
  trusted: ReadonlySet<string>,
): string | undefined => {
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const address = chain[index];
    if (address !== undefined && !trusted.has(address)) {
      return address;
    }
  }
  return undefined;
};

const addressOf = (
  forwardedFor: readonly string[],
  socket: string | undefined,
  trustProxy: TrustProxy,
): string | undefined => {
  if (trustProxy === false || forwardedFor.length === 0) return socket;
  if (trustProxy === true) return forwardedFor[0];
  if (typeof trustProxy === 'number') {
    // More hops than entries leaves nothing trusted, so the peer is the client.
    if (trustProxy > forwardedFor.length) return socket;
    return forwardedFor[forwardedFor.length - trustProxy] ?? socket;
  }
  return firstUntrusted(chainOf(forwardedFor, socket), trustedOf(trustProxy)) ?? forwardedFor[0];
};

export { addressOf, forwardedValues, type Forwarded, type RequestOptions, type TrustProxy };
