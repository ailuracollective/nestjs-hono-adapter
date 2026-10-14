import type { IncomingMessage } from 'node:http';

import type { NestContext } from '#adapter/core/context';
import type {
  Incoming,
  Socket,
} from '#adapter/core/ports/bindings';
import type { ParsedQuery } from './query/index.ts';

/** The request object Nest's core reads. */
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
  socket: IncomingMessage['socket'] & Socket;
  raw: IncomingMessage & Incoming;
  body: unknown;
  rawBody: Buffer | undefined;
  session: unknown;
  files:
    | Record<string, unknown>
    | readonly unknown[]
    | undefined;
  /** The single upload an interceptor stored. */
  file: unknown;
}

/** Continues to whatever handles the request next. */
type NextHandler = () => unknown;

/** A handler as Nest registers it. */
type NestHandler = (
  request: NestRequest,
  response: NestContext,
  next: NextHandler,
) => unknown;

export type { NestHandler, NestRequest, NextHandler };
