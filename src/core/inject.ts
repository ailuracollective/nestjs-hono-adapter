import type { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';

import type { NestHono } from './context.ts';
import { send, splitTarget } from './inject-request.ts';
import { toResponse } from './inject-response.ts';

/** What light-my-request accepts where a query is expected. */
type InjectQuery = string | Record<string, string | string[]>;

/** The object form of `url`, as light-my-request declares it. */
interface InjectUrl {
  readonly pathname: string;
  readonly protocol?: string;
  readonly hostname?: string;
  readonly port?: string | number;
  readonly query?: InjectQuery;
}

type InjectHeaders = Record<
  string,
  string | number | readonly string[] | undefined
>;

type InjectPayload =
  | string
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | Record<string, unknown>;

/** What such a payload becomes once it is a request body. */
type InjectBody = string | Uint8Array | ArrayBuffer;

/**
 * What a test asks an in-process request for. The names are
 * light-my-request's, so a suite that moved off Fastify keeps
 * calling `inject()` the way it did.
 *
 * The options that would change the answer, and that a call
 * with no socket under it cannot answer, are refused by name
 * rather than ignored: `remoteAddress`, `authority`, `Request`
 * and `payloadAsStream`. The rest of light-my-request's surface
 * — `simulate`, `validate`, `autoStart` and `server` —
 * describes how a socket is driven, which is not something an
 * in-process call decides, so it is accepted and has no
 * effect.
 */
interface InjectOptions {
  /** A path, an absolute URL, or light-my-request's object form. */
  readonly url?: string | InjectUrl;
  /** The alias of `url` light-my-request also carries. */
  readonly path?: string | InjectUrl;
  /** Also carried in the string form, as `'GET /path'`. */
  readonly method?: string;
  readonly headers?: InjectHeaders;
  readonly query?: InjectQuery;
  readonly payload?: InjectPayload;
  /** The alias of `payload` light-my-request also carries. */
  readonly body?: InjectPayload;
  readonly cookies?: Record<string, string>;
  readonly signal?: AbortSignal;
  /** How the bytes are written to a socket. */
  readonly simulate?: Record<string, boolean>;
  /** Whether light-my-request validates its own options. */
  readonly validate?: boolean;
  /**
   * Whether light-my-request starts the server it dispatches
   * into.
   */
  readonly autoStart?: boolean;
  /** The server to dispatch into, reached directly here. */
  readonly server?: unknown;
  /** The address the client would have had. */
  readonly remoteAddress?: string;
  /** The authority the request would have carried. */
  readonly authority?: string;
  /** A custom request class, which has no counterpart here. */
  readonly Request?: object;
  /** Whether the payload is a stream rather than bytes. */
  readonly payloadAsStream?: boolean;
}

/**
 * A `set-cookie` header, parsed the way light-my-request parses
 * one: the pair, and the attributes that follow it. It is the
 * one type here written to while it is built, so it is the one
 * that is not read-only.
 */
interface InjectCookie {
  name: string;
  value: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  [attribute: string]: unknown;
}

/**
 * What an in-process request answers: light-my-request's
 * `Response`, minus the two fields that describe a socket this
 * call never opened. `raw` would be Node's request and response
 * objects, and `trailers` a header block the Fetch API has no
 * place for; both are absent rather than faked, and
 * platform-differences.md says so.
 *
 * `statusMessage` is the answer's status text. Hono builds
 * every answer through `Response`, whose status text a runtime
 * leaves empty unless a handler set one, so it is usually `''`
 * where Node would have said `'OK'`.
 */
interface InjectResponse {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  rawPayload: Buffer;
  payload: string;
  body: string;
  cookies: InjectCookie[];
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a test that named a type keeps naming it.
  json: <Answer = unknown>() => Answer;
  stream: () => Readable;
}

/** A target once its url and its method are both known. */
interface Target {
  /** Upper case, empty when the call named none. */
  readonly method: string;
  readonly url: string | InjectUrl;
}

/** The surface the adapter carries, installed as `inject`. */
type InjectRunner = (
  options?: string | InjectOptions,
) => Promise<InjectResponse>;

/**
 * The options refused rather than ignored. Each one would
 * change the answer — an address, an authority, a request
 * class, a streaming payload — and there is no socket here to
 * change it with.
 */
const REFUSED: Record<string, string> = {
  Request:
    'a request class describes a socket this call never opens',
  authority:
    'the authority belongs to the target, not to the call',
  payloadAsStream:
    'the payload is read as bytes, never as a stream',
  remoteAddress: 'the client address comes from the transport',
};

/** The options a call named, in the object form. */
function asOptions(
  options: string | InjectOptions,
): InjectOptions {
  if (typeof options === 'string') {
    return { url: options };
  }
  return options;
}

/** Refuses the options that would change the answer. */
function refuse(asked: InjectOptions): void {
  for (const [name, given] of Object.entries(asked)) {
    const reason = REFUSED[name];
    if (reason !== undefined && given !== undefined) {
      throw new Error(
        `inject() cannot honour the ${name} option: ${reason}.`,
      );
    }
  }
}

/** The string form split, or the object form kept whole. */
function asSplit(raw: string | InjectUrl): Target {
  if (typeof raw === 'string') {
    return splitTarget(raw);
  }
  return { method: '', url: raw };
}

/** The method a call asks for, in upper case. */
function resolveMethod(
  asked: InjectOptions,
  carried: string,
): string {
  const { method } = asked;
  const named = method ?? carried;
  if (named === '') {
    return 'GET';
  }
  return named.toUpperCase();
}

/** The target a call names, and the method it asks for. */
function toTarget(asked: InjectOptions): Target {
  const { path, url } = asked;
  const raw = url ?? path ?? '/';
  const carried = asSplit(raw);
  return {
    method: resolveMethod(asked, carried.method),
    url: carried.url,
  };
}

/**
 * Builds the runner the adapter carries as `inject`.
 *
 * The request is built as a Web `Request` and driven through
 * Hono's own `app.request()`, the in-process path the fetch
 * transport already takes: nothing is bound to a port, and
 * Nest's initialization happens on the first call, so a suite
 * that never listens still reaches its routes.
 */
function createInject(app: NestHono): InjectRunner {
  return async (options = {}): Promise<InjectResponse> => {
    const asked = asOptions(options);
    refuse(asked);
    const target = toTarget(asked);
    const response = await send(app, asked, target);
    return toResponse(response);
  };
}

export type {
  InjectBody,
  InjectCookie,
  InjectHeaders,
  InjectOptions,
  InjectPayload,
  InjectQuery,
  InjectResponse,
  InjectRunner,
  InjectUrl,
  Target,
};
export { createInject };
