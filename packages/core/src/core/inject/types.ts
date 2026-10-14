import type { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';

/** The query a call may carry. */
type InjectQuery = string | Record<string, string | string[]>;

/** The object form of `url`. */
interface InjectUrl {
  /** The path of the URL. */
  readonly pathname: string;
  /** The query of the URL, if any. */
  readonly protocol?: string;
  /** The authority of the URL, if any. */
  readonly hostname?: string;
  /** The port of the URL, if any. */
  readonly port?: string | number;
  /** The query of the URL, if any. */
  readonly query?: InjectQuery;
}

/** The headers a call may name. */
type InjectHeaders = Record<
  string,
  string | number | readonly string[] | undefined
>;

/** What a call may carry as a payload. */
type InjectPayload =
  | string
  | Buffer
  | Uint8Array
  | ArrayBuffer
  | Record<string, unknown>;

/** What such a payload becomes once it is a request body. */
type InjectBody = string | Uint8Array | ArrayBuffer;

/** What a test asks an in-process request for. */
interface InjectOptions {
  /** A path, an absolute URL, or the object form. */
  readonly url?: string | InjectUrl;
  /** The alias of `url`. */
  readonly path?: string | InjectUrl;
  /** Also carried in the string form, as `'GET /path'`. */
  readonly method?: string;
  /** The headers to include in the request. */
  readonly headers?: InjectHeaders;
  /** The query parameters for the request. */
  readonly query?: InjectQuery;
  /** The payload for the request. */
  readonly payload?: InjectPayload;
  /** The alias of `payload`. */
  readonly body?: InjectPayload;
  /** The cookies to include in the request. */
  readonly cookies?: Record<string, string>;
  /** The signal to use for aborting the request. */
  readonly signal?: AbortSignal;
  /** How the bytes are written to a socket. */
  readonly simulate?: Record<string, boolean>;
  /** Whether the options are validated. */
  readonly validate?: boolean;
  /** Whether the server is started before dispatch. */
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

/** One `set-cookie` header parsed into a cookie. */
interface InjectCookie {
  /** The name the cookie carries. */
  name: string;
  /** The value the cookie carries. */
  value: string;
  /** When the cookie expires, if it does. */
  expires?: Date;
  /** The maximum age of the cookie, if it does. */
  maxAge?: number;
  /** Whether the cookie is secure. */
  secure?: boolean;
  /** Whether the cookie is HTTP-only. */
  httpOnly?: boolean;
  /** The site the cookie is same-origin to. */
  sameSite?: string;
  /** Any other attributes the cookie carries. */
  [attribute: string]: unknown;
}

/** What an in-process request answers. */
interface InjectResponse {
  /** The status code the answer carries. */
  statusCode: number;
  /** The status message the answer carries. */
  statusMessage: string;
  /** The headers the answer carries. */
  headers: Record<string, string | string[]>;
  /** The raw payload of the answer. */
  rawPayload: Buffer;
  /** The payload of the answer as a string. */
  payload: string;
  /** The body of the answer as a string. */
  body: string;
  /** The cookies the answer carries. */
  cookies: InjectCookie[];
  /** The body of the answer as JSON. */
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the generic is light-my-request's, and a test that named a type keeps naming it.
  json: <Answer = unknown>() => Answer;
  /** The body of the answer as bytes. */
  stream: () => Readable;
}

/** A target once its url and its method are both known. */
interface Target {
  /** Upper case, empty when the call named none. */
  readonly method: string;
  /** The URL of the target. */
  readonly url: string | InjectUrl;
}

/** The surface the adapter carries, installed as `inject`. */
type InjectRunner = (
  options?: string | InjectOptions,
) => Promise<InjectResponse>;

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
