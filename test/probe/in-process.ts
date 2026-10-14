import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { Bindings } from '#adapter/core/ports/bindings';
import type { ServerAdapter } from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

import type { ProbeApplication } from './types.ts';

/** The port a probe asks the system to pick for it. */
const ANY_PORT = 0;

/** The interface a probe listens on. */
const LOCALHOST = '127.0.0.1';

/** The request an in-process request is read from. */
const SYNTHETIC_INCOMING = new RequestCarrier(undefined);

/** The bindings an in-process request is run with. */
const IN_PROCESS_ENV: Bindings = {
  incoming: SYNTHETIC_INCOMING,
  server: SYNTHETIC_SERVER,
};

/** The Web `Request` class the process started with. */
const PROCESS_REQUEST = globalThis.Request;
/** The Web `Response` class the process started with. */
const PROCESS_RESPONSE = globalThis.Response;

/** Puts the process's own Web classes back. */
const restoreWebClasses = (): void => {
  globalThis.Request = PROCESS_REQUEST;
  globalThis.Response = PROCESS_RESPONSE;
};

/** The Nest options for a probe. */
const applicationOptions = (
  given: ProbeApplication | undefined,
): ProbeApplication => {
  const merged: ProbeApplication = { logger: false };
  if (given === undefined) {
    return merged;
  }
  Object.assign(merged, given);
  merged.logger = given.logger ?? false;
  return merged;
};

/** Parses text as JSON. */
const parseJson = (text: string): unknown =>
  JSON.parse(text) as unknown;

/** Reads a response body as JSON when it declares JSON. */
const bodyOf = (text: string, contentType: string): unknown => {
  if (!contentType.includes('json') || text === '') {
    return text;
  }
  return parseJson(text);
};

/** The address a listening adapter answers on. */
const originOf = (adapter: ServerAdapter): string => {
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string') {
    throw new TypeError(
      'the adapter is not listening on a port',
    );
  }
  return `http://${LOCALHOST}:${address.port}`;
};

export {
  ANY_PORT,
  IN_PROCESS_ENV,
  LOCALHOST,
  applicationOptions,
  bodyOf,
  originOf,
  restoreWebClasses,
};
