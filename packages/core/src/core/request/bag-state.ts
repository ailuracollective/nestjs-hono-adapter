import type { NestContext } from '#adapter/core/context';
import type { Incoming } from '#adapter/core/ports/bindings';
import { forwardedValues } from './forwarded.ts';
import type { Forwarded, RequestOptions } from './forwarded.ts';
import type { ParsedQuery } from './query/index.ts';

/** The parts of the request URL a bag answers with. */
interface UrlParts {
  readonly hostname: string;
  readonly pathname: string;
  readonly protocol: string;
  readonly search: string;
  route: string | undefined;
}

/** The fields a request bag builds on demand. */
interface BagState {
  readonly context: NestContext;
  readonly options: RequestOptions;
  forwarded: Forwarded | undefined;
  headers: Record<string, string> | undefined;
  hostname: string | undefined;
  hosts: Record<string, string> | undefined;
  incoming: Incoming | undefined;
  ip: string | undefined;
  method: string | undefined;
  params: Record<string, string> | undefined;
  protocol: string | undefined;
  query: ParsedQuery | undefined;
  url: UrlParts | undefined;
}

/** The parts of the request URL, read once and kept. */
const urlPartsOf = (state: BagState): UrlParts => {
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
};

/** The forwarded headers a deployment trusts, read once. */
const forwardedOf = (state: BagState): Forwarded => {
  const held = state.forwarded;
  if (held !== undefined) {
    return held;
  }
  const values = forwardedValues(state.context, state.options);
  state.forwarded = values;
  return values;
};

/** The Node message the request arrived on, when there is one. */
const incomingOf = (state: BagState): Incoming | undefined => {
  const held = state.incoming;
  if (held !== undefined) {
    return held;
  }
  const incoming: Incoming | undefined =
    state.context.env?.incoming;
  state.incoming = incoming;
  return incoming;
};

/**
 * The Node message, for the fields Nest types as always
 * present.
 */
const required = (state: BagState): Incoming => {
  const incoming = incomingOf(state);
  if (incoming === undefined) {
    throw new TypeError(
      'the request arrived without a carrier, so this field has nothing to read',
    );
  }
  return incoming;
};

export { forwardedOf, incomingOf, required, urlPartsOf };
export type { BagState, UrlParts };
