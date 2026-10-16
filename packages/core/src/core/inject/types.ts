import type { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';

type InjectQuery = string | Record<string, string | string[]>;

interface InjectUrl {
  readonly pathname: string;
  readonly protocol?: string;
  readonly hostname?: string;
  readonly port?: string | number;
  readonly query?: InjectQuery;
}

type InjectHeaders = Record<string, string | number | readonly string[] | undefined>;

type InjectPayload = string | Buffer | Uint8Array | ArrayBuffer | Record<string, unknown>;

type InjectBody = string | Uint8Array | ArrayBuffer;

interface InjectOptions {
  readonly url?: string | InjectUrl;
  readonly path?: string | InjectUrl;
  readonly method?: string;
  readonly headers?: InjectHeaders;
  readonly query?: InjectQuery;
  readonly payload?: InjectPayload;
  readonly body?: InjectPayload;
  readonly cookies?: Record<string, string>;
  readonly signal?: AbortSignal;
  readonly simulate?: Record<string, boolean>;
  readonly validate?: boolean;
  readonly autoStart?: boolean;
  readonly server?: unknown;
  readonly remoteAddress?: string;
  readonly authority?: string;
  readonly Request?: object;
  readonly payloadAsStream?: boolean;
}

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

interface Target {
  readonly method: string;
  readonly url: string | InjectUrl;
}

type InjectRunner = (options?: string | InjectOptions) => Promise<InjectResponse>;

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
