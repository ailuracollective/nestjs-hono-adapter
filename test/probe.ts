/**
 * The probe plumbing: the types a case describes a probe with,
 * the two paths a probe answers through, and the function that
 * sends a request to it.
 *
 * The Nest fixture a probe starts lives in `./support.ts`,
 * which also owns the two entry points that name it, so nothing
 * here knows what a controller is and the two files stay
 * independent of each other.
 */

import type {
  INestApplication,
  NestApplicationOptions,
  Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RequestCarrier } from '../src/core/bindings.ts';
import type { Bindings } from '../src/core/bindings.ts';
import type { ServerAdapter } from '../src/index.ts';
import { bunAdapter } from './bun-adapter.ts';
import type { AdapterOptions } from './bun-adapter.ts';
import { SYNTHETIC_SERVER } from './bun-bindings.ts';

/** The port a probe asks the system to pick for it. */
const ANY_PORT = 0;

/** The interface a probe listens on. */
const LOCALHOST = '127.0.0.1';

/**
 * The path a probe answers through when the case did not
 * choose.
 */
const SOCKET_MODE = 'socket';

/**
 * The path a probe answers through when the case asks for the
 * fast one.
 */
const IN_PROCESS_MODE = 'in-process';

/**
 * The request an in-process request is read from: one that
 * never arrived. Its socket reports no address, which is the
 * truth of a request nobody sent.
 */
const SYNTHETIC_INCOMING = new RequestCarrier(undefined);

/**
 * The bindings an in-process request is run with, written by
 * hand because no transport will build them: the request
 * carrier Nest's SSE path reads, and the native Bun server. A
 * hand-written binding is what makes the claim explicit rather
 * than accidental: a case on this path exercises the handler
 * chain, not the transport, and a case that needs a real
 * connection asks for a socket probe instead of being handed
 * one that pretends it was there.
 */
const IN_PROCESS_ENV: Bindings = {
  incoming: SYNTHETIC_INCOMING,
  server: SYNTHETIC_SERVER,
};

/** What one request through a running application saw. */
interface ProbeResult {
  readonly body: unknown;
  readonly contentType: string;
  readonly headers: Headers;
  readonly status: number;
  readonly text: string;
}

/**
 * How a probe answers: `in-process` runs the whole pipeline
 * inside the test with no listener and no port, `socket` binds
 * an ephemeral port and answers over a real connection.
 */
type ProbeMode = typeof IN_PROCESS_MODE | typeof SOCKET_MODE;

/** A running application a test talks to. */
interface Probe {
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
  readonly mode: ProbeMode;
  /**
   * Sends one request through whichever path this probe is, and
   * answers with the response as it arrived. A case reads that
   * response itself when the body has to be watched as it
   * comes.
   */
  readonly respond: (
    path: string,
    init?: RequestInit,
  ) => Promise<Response>;
  close: () => Promise<void>;
}

/**
 * The application options a case may name.
 *
 * `return503OnClosing` reaches this package through Nest, and
 * Nest declares it only in versions published after 11. Writing
 * the option directly against `NestApplicationOptions`
 * type-checks against one supported version and fails against
 * the other, so it is carried here as well. The cast below is
 * what that costs: the value is handed to Nest unchanged either
 * way.
 */
type ProbeApplication = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

/** How a probe is built, when the defaults are not enough. */
interface ProbeOptions {
  readonly adapter?: AdapterOptions;
  readonly application?: ProbeApplication;
  readonly configure?: (app: INestApplication) => void;
  /**
   * The module the application is built from, when the probe
   * module is not the one a case needs.
   */
  readonly module?: Type<unknown>;
  /**
   * Which path answers the case. The default is the socket,
   * because a case that never asked for the fast path is still
   * a case about the real transport until it says otherwise.
   */
  readonly mode?: ProbeMode;
}

/**
 * The Nest options for a probe, quiet unless a case asks
 * otherwise.
 */
function applicationOptions(
  given: ProbeApplication | undefined,
): ProbeApplication {
  const merged: ProbeApplication = { logger: false };
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

/** The address a listening adapter answers on. */
function originOf(adapter: ServerAdapter): string {
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return `http://${LOCALHOST}:${address.port}`;
}

/**
 * Starts an application on an adapter the caller already built,
 * from the module the caller named, which is what a case that
 * configures Hono itself needs: a middleware only runs if it is
 * registered before the application starts.
 *
 * The module is a parameter rather than an option because
 * naming one belongs to the fixture in `./support.ts`, which
 * owns the `startProbe` and `startAdapter` a case actually
 * calls.
 *
 * An in-process probe is initialised and never listens, so it
 * binds no port and has nothing to drain on the way out.
 */
async function startApplication(
  adapter: ServerAdapter,
  module: Type<unknown>,
  options: ProbeOptions = {},
): Promise<Probe> {
  const app = await NestFactory.create(
    module,
    adapter,
    applicationOptions(options.application),
  );
  if (options.configure !== undefined) {
    options.configure(app);
  }
  if (options.mode === IN_PROCESS_MODE) {
    await app.init();
    return {
      adapter,
      app,
      close: () => app.close(),
      mode: IN_PROCESS_MODE,
      respond: (path, init) =>
        Promise.resolve(
          adapter.getHono().request(path, init, IN_PROCESS_ENV),
        ),
    };
  }
  await app.listen(ANY_PORT, LOCALHOST);
  const origin = originOf(adapter);
  return {
    adapter,
    app,
    close: () => app.close(),
    mode: SOCKET_MODE,
    respond: (path, init) => fetch(`${origin}${path}`, init),
  };
}

/** Reports what one request saw, whichever path answered it. */
async function request(
  probe: Probe,
  path: string,
  init?: RequestInit,
): Promise<ProbeResult> {
  const response = await probe.respond(path, init);
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

/**
 * Starts an application of its own, on an adapter of its own.
 *
 * The two entry points that name the fixture live in
 * `./support.ts`; this one is the same start without the
 * fixture, so a case that builds its own module brings it here.
 * Naming the module is required rather than defaulted, which is
 * what keeps this file from importing the fixture back and the
 * two from cycling.
 */
function startProbe(
  options: ProbeOptions = {},
): Promise<Probe> {
  const { module } = options;
  if (module === undefined) {
    throw new TypeError(
      'a probe built without the fixture names its own module',
    );
  }
  return startApplication(
    bunAdapter(options.adapter),
    module,
    options,
  );
}

export { request, startApplication, startProbe };
export type {
  ProbeApplication,
  Probe,
  ProbeMode,
  ProbeOptions,
  ProbeResult,
};
