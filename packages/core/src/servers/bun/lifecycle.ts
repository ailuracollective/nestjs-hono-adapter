import type {
  BunAddress,
  BunRuntime,
} from '#adapter/servers/bun-runtime';

/** The address Nest formats, or the path a unix socket is on. */
const addressOf = (
  unix: string | undefined,
  server: BunRuntime | undefined,
): BunAddress | string | undefined => {
  if (unix !== undefined) {
    return unix;
  }
  if (server === undefined) {
    return undefined;
  }
  const address = server.hostname ?? '0.0.0.0';
  let family = 'IPv4';
  if (address.includes(':')) {
    family = 'IPv6';
  }
  return { address, family, port: server.port ?? 0 };
};

/** Stops a running server and settles when it has. */
const closeServer = async (
  server: BunRuntime | undefined,
  closeActiveConnections: boolean,
): Promise<void> => {
  if (server !== undefined) {
    await server.stop(closeActiveConnections);
  }
};

export { addressOf, closeServer };
