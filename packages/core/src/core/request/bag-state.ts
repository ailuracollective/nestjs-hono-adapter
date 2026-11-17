import type { NestContext } from '#adapter/core/context';
import type { Incoming } from '#adapter/core/ports/bindings';
import { forwardedValues } from './forwarded.ts';
import type { Forwarded, RequestOptions } from './forwarded.ts';
import type { ParsedQuery } from './query/index.ts';

const MISSING = -1;

interface UrlParts {
  readonly hostname: string;
  readonly pathname: string;
  readonly protocol: string;
  readonly search: string;
  route: string | undefined;
}

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
  mount: string | undefined;
  params: Record<string, string> | undefined;
  paramsAt: number | undefined;
  protocol: string | undefined;
  query: ParsedQuery | undefined;
  url: UrlParts | undefined;
}

const urlPartsOf = (state: BagState): UrlParts => {
  const held = state.url;
  if (held !== undefined) return held;
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

// The query string alone, without the `URL` parse the rest of the parts need.
const searchOf = (context: NestContext): string => {
  const { url } = context.req;
  const start = url.indexOf('?');
  if (start === MISSING) return '';
  const hash = url.indexOf('#', start);
  return hash === MISSING ? url.slice(start) : url.slice(start, hash);
};

const forwardedOf = (state: BagState): Forwarded => {
  const held = state.forwarded;
  if (held !== undefined) return held;
  const values = forwardedValues(state.context, state.options);
  state.forwarded = values;
  return values;
};

const incomingOf = (state: BagState): Incoming | undefined => {
  const held = state.incoming;
  if (held !== undefined) return held;
  const incoming: Incoming | undefined = state.context.env?.incoming;
  state.incoming = incoming;
  return incoming;
};

export { forwardedOf, incomingOf, searchOf, urlPartsOf };
export type { BagState, UrlParts };
