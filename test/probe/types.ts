import type {
  INestApplication,
  NestApplicationOptions,
  Type,
} from '@nestjs/common';

import type { ServerAdapter } from '#adapter/index';
import type { AdapterOptions } from '#test/bun-adapter';

/** The path a probe answers through by default. */
const SOCKET_MODE = 'socket';

/** The path a probe answers through with no listener. */
const IN_PROCESS_MODE = 'in-process';

/** What one request through a running application saw. */
interface ProbeResult {
  /** The parsed body. */
  readonly body: unknown;
  /** The response content type. */
  readonly contentType: string;
  /** The response headers. */
  readonly headers: Headers;
  /** The response status. */
  readonly status: number;
  /** The response body as text. */
  readonly text: string;
}

/** How a probe answers: in process or over a socket. */
type ProbeMode = typeof IN_PROCESS_MODE | typeof SOCKET_MODE;

/** A running application a test talks to. */
interface Probe {
  /** The adapter the application runs on. */
  readonly adapter: ServerAdapter;
  /** The Nest application. */
  readonly app: INestApplication;
  /** The path this probe answers through. */
  readonly mode: ProbeMode;
  /** Sends one request and answers with its response. */
  readonly respond: (
    path: string,
    init?: RequestInit,
  ) => Promise<Response>;
  /** Closes the application. */
  close: () => Promise<void>;
}

/** The application options a case may name. */
type ProbeApplication = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

/** How a probe is built, when the defaults are not enough. */
interface ProbeOptions {
  /** The adapter options. */
  readonly adapter?: AdapterOptions;
  /** The Nest application options. */
  readonly application?: ProbeApplication;
  /** Configures the application before it starts. */
  readonly configure?: (app: INestApplication) => void;
  /** The module the application is built from. */
  readonly module?: Type<unknown>;
  /** Which path answers the case. */
  readonly mode?: ProbeMode;
}

export { IN_PROCESS_MODE, SOCKET_MODE };
export type {
  Probe,
  ProbeApplication,
  ProbeMode,
  ProbeOptions,
  ProbeResult,
};
