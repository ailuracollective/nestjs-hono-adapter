import type { BunAddress, BunRuntime } from '#adapter/servers/bun-runtime';

const addressOf = (
  unix: string | undefined,
  server: BunRuntime | undefined,
): BunAddress | string | undefined => {
  if (unix !== undefined) return unix;
  if (server === undefined) return undefined;
  const address = server.hostname ?? '0.0.0.0';
  let family = 'IPv4';
  if (address.includes(':')) {
    family = 'IPv6';
  }
  return { address, family, port: server.port ?? 0 };
};

const closeServer = async (
  server: BunRuntime | undefined,
  closeActiveConnections: boolean,
): Promise<void> => {
  if (server !== undefined) await server.stop(closeActiveConnections);
};

export { addressOf, closeServer };
