import type { INestApplication, NestApplicationOptions, Type } from '@nestjs/common';

import type { ServerAdapter } from '#adapter/index';
import type { AdapterOptions } from '#test/bun-adapter';

const SOCKET_MODE = 'socket';

const IN_PROCESS_MODE = 'in-process';

interface ProbeResult {
  readonly body: unknown;
  readonly contentType: string;
  readonly headers: Headers;
  readonly status: number;
  readonly text: string;
}

type ProbeMode = typeof IN_PROCESS_MODE | typeof SOCKET_MODE;

interface Probe {
  readonly adapter: ServerAdapter;
  readonly app: INestApplication;
  readonly mode: ProbeMode;
  readonly respond: (path: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
}

type ProbeApplication = NestApplicationOptions & {
  readonly return503OnClosing?: boolean;
};

interface ProbeOptions {
  readonly adapter?: AdapterOptions;
  readonly application?: ProbeApplication;
  readonly configure?: (app: INestApplication) => void;
  readonly module?: Type<unknown>;
  readonly mode?: ProbeMode;
}

export { IN_PROCESS_MODE, SOCKET_MODE };
export type { Probe, ProbeApplication, ProbeMode, ProbeOptions, ProbeResult };
