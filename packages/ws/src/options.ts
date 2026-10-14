const ROOT_PATH = '/';

const UNDERLYING_PORT = 0;

interface GatewayOptions {
  readonly path?: string;
  readonly [name: string]: unknown;
}

const normalizePath = (path?: string): string => {
  if (path === undefined || path === '') return ROOT_PATH;
  return path.startsWith(ROOT_PATH) ? path : `${ROOT_PATH}${path}`;
};

/** Only `path` is servable: every gateway is served by the Hono application the transport built. */
const ensureSupported = (port: number, options: GatewayOptions): void => {
  if (port !== UNDERLYING_PORT) {
    throw new TypeError(
      "Every gateway is served on the HTTP adapter's own " +
        `server, so the gateway port ${port} cannot be honoured.`,
    );
  }
  const refused = Object.keys(options).find((name) => name !== 'path');
  if (refused !== undefined) {
    throw new TypeError(`The Hono adapter cannot honour the gateway option ${refused}.`);
  }
};

export { ensureSupported, normalizePath };
export type { GatewayOptions };
