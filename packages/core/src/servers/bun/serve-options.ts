import { MAX_BODY_SIZE } from '#adapter/servers/bun-runtime';

import type { BunRuntime } from '#adapter/servers/bun-runtime';

/** The options every server is given, whatever its transport. */
const baseOptions = (
  fetch: (
    request: Request,
    server: BunRuntime,
  ) => Response | Promise<Response>,
  websocket: unknown,
  tls: unknown,
): Record<string, unknown> => {
  const options: Record<string, unknown> = {
    fetch,
    maxRequestBodySize: MAX_BODY_SIZE,
  };
  if (websocket !== undefined) {
    options.websocket = websocket;
  }
  if (tls !== undefined) {
    options.tls = tls;
  }
  return options;
};

/** Fills in the address to listen on and names any unix path. */
const applyAddress = (
  options: Record<string, unknown>,
  port: string | number,
  hostname: string | undefined,
): string | undefined => {
  if (typeof port === 'string') {
    options.unix = port;
    return port;
  }
  options.port = port;
  if (hostname !== undefined) {
    options.hostname = hostname;
  }
  return undefined;
};

export { applyAddress, baseOptions };
