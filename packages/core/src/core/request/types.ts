import type { IncomingMessage } from 'node:http';
import type { Readable, Writable } from 'node:stream';

import type { NestContext } from '#adapter/core/context';
import type { Incoming, Socket } from '#adapter/core/ports/bindings';
import type { ParsedQuery } from './query/index.ts';

type StreamListener = Parameters<Readable['on']>[1];

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
  socket: (IncomingMessage['socket'] & Socket) | undefined;
  raw: (IncomingMessage & Incoming) | undefined;
  complete: boolean;
  readable: boolean;
  body: unknown;
  rawBody: Buffer | undefined;
  session: unknown;
  files: Record<string, unknown> | readonly unknown[] | undefined;
  file: unknown;
  is: (type: string | readonly string[]) => string | false;
  get: (name: string) => string | undefined;
  header: (name: string) => string | undefined;
  stream: Readable;
  readableEnded: boolean;
  pipe: <Destination extends Writable>(
    destination: Destination,
    options?: { end?: boolean },
  ) => Destination;
  unpipe: (destination?: Writable) => NestRequest;
  resume: () => NestRequest;
  pause: () => NestRequest;
  on: (event: string, listener: StreamListener) => NestRequest;
  once: (event: string, listener: StreamListener) => NestRequest;
}

type NextHandler = () => unknown;

type NestHandler = (request: NestRequest, response: NestContext, next: NextHandler) => unknown;

export type { NestHandler, NestRequest, NextHandler, StreamListener };
