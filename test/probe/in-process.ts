import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { Bindings } from '#adapter/core/ports/bindings';
import type { ServerAdapter } from '#adapter/index';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';

import type { ProbeApplication } from './types.ts';

const ANY_PORT = 0;

const LOCALHOST = '127.0.0.1';

const SYNTHETIC_INCOMING = new RequestCarrier(undefined);

const IN_PROCESS_ENV: Bindings = {
  incoming: SYNTHETIC_INCOMING,
  server: SYNTHETIC_SERVER,
};

const PROCESS_REQUEST = globalThis.Request;
const PROCESS_RESPONSE = globalThis.Response;

const restoreWebClasses = (): void => {
  globalThis.Request = PROCESS_REQUEST;
  globalThis.Response = PROCESS_RESPONSE;
};

const applicationOptions = (given: ProbeApplication | undefined): ProbeApplication => {
  const merged: ProbeApplication = { logger: false };
  if (given === undefined) return merged;
  Object.assign(merged, given);
  merged.logger = given.logger ?? false;
  return merged;
};

const parseJson = (text: string): unknown => JSON.parse(text) as unknown;

const bodyOf = (text: string, contentType: string): unknown => {
  if (!contentType.includes('json') || text === '') {
    return text;
  }
  return parseJson(text);
};

const originOf = (adapter: ServerAdapter): string => {
  const address = adapter.getHttpServer().address();
  if (address === undefined || typeof address === 'string')
    throw new TypeError('the adapter is not listening on a port');
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
