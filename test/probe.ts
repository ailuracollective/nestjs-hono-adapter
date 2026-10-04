/**
 * The probe: an application of its own, built the way the suite
 * talks to it.
 *
 * A probe has two modes, and which one it has is the case's
 * choice. `in-process`, the default, drives the adapter with a
 * request that arrived on objects nobody is holding open, so no
 * case binds a listener, a port or a teardown. `socket` binds a
 * real listener, which is what a case whose client has to exist
 * for — to read a live stream, or to walk away from one — asks
 * for by name.
 *
 * Every case gets its own application, so no case can pass
 * because another one left a server, a filter or a route
 * behind.
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { HttpStatus } from '@nestjs/common';
import type {
  INestApplication,
  NestApplicationOptions,
  Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { ServerAdapterOptions } from '../src/index.ts';
import { ServerAdapter } from '../src/index.ts';
import type { StreamInterceptor } from '../src/core/handler-bridge.ts';
import { createRouteHandler } from '../src/core/handler-bridge.ts';
import { ProbeModule } from './support.ts';

/** The port a socket probe asks the system to pick for it. */
const ANY_PORT = 0;

/** The interface a socket probe listens on. */
const LOCALHOST = '127.0.0.1';

/**
 * The origin an in-process probe answers on. Nothing resolves
 * that name, which is the point: a case that meant to reach a
 * client fails rather than quietly reaching a probe with none.
 */
const IN_PROCESS_ORIGIN = 'http://probe.invalid';

/** The route a probe serves a case's own bridge on. */
const BRIDGE_ROUTE = '/bridge/probe';

/** The status a probe's bridge reports to an interceptor. */
const PENDING_STATUS = HttpStatus.ACCEPTED;

/**
 * Which of the two ways a probe reaches its application.
 *
 * `in-process` binds nothing; `socket` binds a real listener,
 * and a case that needs a client to read or to cut a connection
 * asks for it by name.
 */
type ProbeMode = 'in-process' | 'socket';

/** What one request through a running application saw. */
interface ProbeResult {
  readonly body: unknown;
  readonly contentType: string;
  readonly headers: Headers;
  readonly status: number;
  readonly text: string;
}

/** A running application a test talks to. */
interface Probe {
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
  /** How this probe reaches its application. */
  readonly mode: ProbeMode;
  readonly origin: string;
  close: () => Promise<void>;
}

/** How a probe is built, when the defaults are not enough. */
interface ProbeOptions {
  readonly adapter?: ServerAdapterOptions;
  readonly application?: NestApplicationOptions;
  readonly configure?: (app: INestApplication) => void;
  /**
   * The module the application is built from, when the probe
   * module is not the one a case needs.
   */
  readonly module?: Type<unknown>;
  /**
   * Which of the two ways the probe reaches its application.
   * The default drives the adapter in process.
   */
  readonly mode?: ProbeMode;
}

/** The Node objects Hono attaches to every request it serves. */
interface Bindings {
  readonly incoming: IncomingMessage;
  readonly outgoing: ServerResponse;
}

/** What one request through a case's own bridge answered. */
interface BridgeAnswer {
  readonly status: number;
  readonly text: string;
}

/**
 * The Nest options for a probe, quiet unless a case asks
 * otherwise.
 */
function applicationOptions(
  given: NestApplicationOptions | undefined,
): NestApplicationOptions {
  const merged: NestApplicationOptions = { logger: false };
  if (given === undefined) {
    return merged;
  }
  Object.assign(merged, given);
  merged.logger = given.logger ?? false;
  return merged;
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function bodyOf(text: string, contentType: string): unknown {
  if (!contentType.includes('json') || text === '') {
    return text;
  }
  return parseJson(text);
}

/**
 * The socket an in-process request is said to arrive on. It is
 * never connected, so it holds no port, and with no handle to
 * read an address from it reports none, so the peer the request
 * is given is put on it directly.
 */
function syntheticSocket(): Socket {
  const socket = new Socket();
  Object.defineProperty(socket, 'remoteAddress', {
    configurable: true,
    value: LOCALHOST,
  });
  return socket;
}

/** The options of one request, whether or not any were given. */
function initOf(init: RequestInit | undefined): RequestInit {
  return init ?? {};
}

/** The headers of a request, as the incoming message keeps them. */
function incomingHeaders(
  init: RequestInit,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [name, value] of new Headers(init.headers)) {
    record[name] = value;
  }
  return record;
}

/**
 * The objects an in-process request arrives on: the incoming
 * message the adapter reads its raw request from, and the
 * outgoing response its bindings carry. Nothing is written to
 * either, and neither end is ever connected.
 */
function bindings(path: string, init: RequestInit): Bindings {
  const socket = syntheticSocket();
  const incoming = new IncomingMessage(socket);
  incoming.headers = incomingHeaders(init);
  incoming.method = init.method ?? 'GET';
  incoming.url = path;
  return {
    incoming,
    outgoing: new ServerResponse(incoming),
  };
}

/** How many bytes of a payload a client would have declared. */
function declaredLength(
  body: RequestInit['body'],
): string | undefined {
  if (typeof body === 'string') {
    return String(new TextEncoder().encode(body).byteLength);
  }
  if (body instanceof Uint8Array) {
    return String(body.byteLength);
  }
  return undefined;
}

/**
 * The web request an in-process probe sends, carrying the
 * `content-length` its client would have sent. A client
 * declares how large a payload is and a body limit is checked
 * against that declaration, so a probe that dropped the header
 * would read the bytes before refusing them.
 */
function webRequest(
  origin: string,
  path: string,
  init: RequestInit,
): Request {
  const asked = new Request(`${origin}${path}`, init);
  const length = declaredLength(init.body);
  if (
    length !== undefined &&
    !asked.headers.has('content-length')
  ) {
    asked.headers.set('content-length', length);
  }
  return asked;
}

/**
 * Serves one request without a listener: the Hono application
 * the adapter answers on, called directly with a request that
 * arrived on the bindings above.
 */
function inProcess(
  probe: Probe,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const options = initOf(init);
  const served = probe.adapter
    .getHono()
    .fetch(
      webRequest(probe.origin, path, options),
      bindings(path, options),
    );
  return Promise.resolve(served);
}

/** Answers one request through whichever transport a probe has. */
function answer(
  probe: Probe,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (probe.mode === 'socket') {
    return fetch(`${probe.origin}${path}`, init);
  }
  return inProcess(probe, path, init);
}

/** The body of a JSON request, with the headers it needs. */
function jsonRequest(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  };
}

/** The address a listening probe answers on. */
function listeningOrigin(adapter: ServerAdapter): string {
  const address = adapter.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return `http://${LOCALHOST}:${address.port}`;
}

/**
 * Fails a probe that bound something after all. An in-process
 * probe that quietly listened would answer every case it
 * answered before, and no case would know.
 */
function assertUnbound(adapter: ServerAdapter): void {
  const server = adapter.getHttpServer();
  if (server.listening || server.address() !== null) {
    throw new TypeError('an in-process probe bound a port');
  }
}

/** An in-process probe: the application, and nothing listening. */
function inProcessProbe(
  adapter: ServerAdapter,
  app: INestApplication,
): Probe {
  return {
    adapter,
    app,
    close: () => app.close(),
    mode: 'in-process',
    origin: IN_PROCESS_ORIGIN,
  };
}

/**
 * A socket probe: the application, and the port it is served
 * on.
 */
function socketProbe(
  adapter: ServerAdapter,
  app: INestApplication,
): Probe {
  return {
    adapter,
    app,
    close: () => app.close(),
    mode: 'socket',
    origin: listeningOrigin(adapter),
  };
}

/**
 * Starts an application on an adapter the caller already built,
 * which is what a case that configures Hono itself needs: a
 * middleware only runs if it is registered before the
 * application answers anything.
 */
async function startAdapter(
  adapter: ServerAdapter,
  options: ProbeOptions = {},
): Promise<Probe> {
  const app = await NestFactory.create(
    options.module ?? ProbeModule,
    adapter,
    applicationOptions(options.application),
  );
  if (options.configure !== undefined) {
    options.configure(app);
  }
  if (options.mode === 'socket') {
    await app.listen(ANY_PORT, LOCALHOST);
    return socketProbe(adapter, app);
  }
  // Init is what `listen()` would have done: the routes exist,
  // and no port is ever asked for.
  await app.init();
  assertUnbound(adapter);
  return inProcessProbe(adapter, app);
}

function startProbe(
  options: ProbeOptions = {},
): Promise<Probe> {
  return startAdapter(
    new ServerAdapter(options.adapter),
    options,
  );
}

/**
 * Serves one route through a bridge whose stream interceptor is
 * the caller's, so a case can prove which one was opened. The
 * route is registered before the first request, because Hono's
 * router is already built once a probe has answered anything.
 */
async function mountStream(
  probe: Probe,
  interceptor: StreamInterceptor,
): Promise<BridgeAnswer> {
  const bridge = createRouteHandler(
    (): Promise<unknown> => Promise.resolve(),
    {
      bodyLimit: () => 0,
      bodyParsingEnabled: () => false,
      pendingStatus: () => PENDING_STATUS,
      rawBody: () => false,
      trustProxy: () => false,
    },
    interceptor,
  );
  probe.adapter.getHono().on('GET', BRIDGE_ROUTE, bridge);
  const served = await answer(probe, BRIDGE_ROUTE);
  return { status: served.status, text: await served.text() };
}

/**
 * Asks a probe for one route and reports what came back. Both
 * modes answer through here, and both report the same shape, so
 * a case reads the same answer either way.
 */
async function request(
  probe: Probe,
  path: string,
  init?: RequestInit,
): Promise<ProbeResult> {
  const response = await answer(probe, path, init);
  const text = await response.text();
  const contentType =
    response.headers.get('content-type') ?? '';
  return {
    body: bodyOf(text, contentType),
    contentType,
    headers: response.headers,
    status: response.status,
    text,
  };
}

export {
  jsonRequest,
  mountStream,
  request,
  startAdapter,
  startProbe,
};
export type {
  BridgeAnswer,
  Probe,
  ProbeMode,
  ProbeOptions,
  ProbeResult,
};
