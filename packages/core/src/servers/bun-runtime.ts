import type { SocketAddress } from '#adapter/core/ports/bindings';

interface BunAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

interface BunRuntime {
  readonly hostname: string | undefined;
  readonly port: number | undefined;
  readonly requestIP: (request: Request) => SocketAddress | null;
  readonly stop: (closeActiveConnections?: boolean) => Promise<void>;
}

type ServeOptions = Parameters<typeof Bun.serve>[0];

const MAX_BODY_SIZE = Number.MAX_SAFE_INTEGER;

export { MAX_BODY_SIZE };
export { bunServeStatic } from './bun/static.ts';
export { toBunTls, tlsOf } from './bun/tls.ts';
export type { HttpsOptions } from './bun/tls.ts';
export type { BunAddress, BunRuntime, ServeOptions };
