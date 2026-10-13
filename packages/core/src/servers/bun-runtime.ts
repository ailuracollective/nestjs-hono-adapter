import { stat } from 'node:fs/promises';
import nodePath from 'node:path';

import type { NestApplicationOptions } from '@nestjs/common';
import type { MiddlewareHandler } from 'hono';
import { serveStatic as baseServeStatic } from 'hono/serve-static';

import type { SocketAddress } from '../core/bindings.ts';
import type { NestEnv } from '../core/context.ts';
import type { StaticOptions } from '../core/transport.ts';

/**
 * The Bun API surface the transport binds: the shape of Bun's
 * native server, the TLS options it understands, and the
 * static-file middleware that reads with `Bun.file`.
 */

/** The address Nest formats from a listening server. */
interface BunAddress {
  readonly address: string;
  readonly family: string;
  readonly port: number;
}

/**
 * The part of Bun's native server this transport drives. Typed
 * structurally rather than taken from Bun's own declaration, so
 * the module stays free of that surface.
 */
interface BunRuntime {
  readonly hostname: string | undefined;
  readonly port: number | undefined;
  readonly requestIP: (
    request: Request,
  ) => SocketAddress | null;
  readonly stop: (
    closeActiveConnections?: boolean,
  ) => Promise<void>;
}

/** What Nest allows as TLS options. */
type HttpsOptions = NonNullable<
  NestApplicationOptions['httpsOptions']
>;

/** The options `Bun.serve` takes. */
type ServeOptions = Parameters<typeof Bun.serve>[0];

/**
 * The largest body Bun's server itself accepts. The adapter's
 * own limit is what answers a body that is too large, and that
 * limit can be turned off, so Bun's default cap is raised out
 * of the way: otherwise a deployment that removed its limit
 * would still be stopped at Bun's 128 MiB default.
 */
const MAX_BODY_SIZE = Number.MAX_SAFE_INTEGER;

/**
 * The Node TLS options Bun understands, by the name each keeps
 * on Bun's own options object. The ones with no meaning on
 * Bun's server are left out rather than translated into
 * something that would say less than they do.
 */
const TLS_FIELDS = [
  'key',
  'cert',
  'ca',
  'passphrase',
  'ciphers',
  'secureOptions',
  'requestCert',
  'rejectUnauthorized',
] as const;

/** Maps the Node TLS options a deployment named onto Bun's. */
function toBunTls(
  certificate: HttpsOptions,
): Record<string, unknown> {
  const tls: Record<string, unknown> = {};
  for (const name of TLS_FIELDS) {
    const value = certificate[name] as unknown;
    if (value !== undefined) {
      tls[name] = value;
    }
  }
  return tls;
}

/** The TLS options Bun is started with, when there are any. */
function tlsOf(
  certificate: HttpsOptions | undefined,
): Record<string, unknown> | undefined {
  if (certificate === undefined) {
    return undefined;
  }
  return toBunTls(certificate);
}

/** What the Hono middleware reads as "no file here". */
// oxlint-disable-next-line unicorn/no-null -- the middleware signals "not found" with a null answer.
const NOT_FOUND = null;

/** The file a path names, or nothing when there is none. */
async function readContent(
  target: string,
): Promise<Response | null> {
  const file = Bun.file(target);
  const found = await file.exists();
  if (!found) {
    return NOT_FOUND;
  }
  // A `BunFile` is a `Blob`, which is what the Hono middleware
  // writes as the body; it is cast because the option is typed
  // against the Web `Data` union.
  return file as unknown as Response;
}

/**
 * The content of the file a path names, with the index file
 * answered for a directory. A path that cannot be read is
 * nothing, which is what lets the route behind answer.
 */
async function contentOf(
  filePath: string,
  index: string,
): Promise<Response | null> {
  try {
    const stats = await stat(filePath);
    if (!stats.isDirectory()) {
      return await readContent(filePath);
    }
    return await readContent(nodePath.join(filePath, index));
  } catch {
    return NOT_FOUND;
  }
}

/** The middleware that serves one directory with `Bun.file`. */
function bunServeStatic(
  options: StaticOptions,
): MiddlewareHandler<NestEnv> {
  const config: Record<string, unknown> = {
    getContent: (filePath: string) =>
      contentOf(filePath, options.index),
    isDir: (): boolean => false,
    join: (...parts: string[]) => nodePath.join(...parts),
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined) {
    config.rewriteRequestPath = options.rewriteRequestPath;
  }
  return baseServeStatic<NestEnv>(
    config as unknown as Parameters<
      typeof baseServeStatic<NestEnv>
    >[0],
  );
}

export { bunServeStatic, MAX_BODY_SIZE, toBunTls, tlsOf };
export type {
  BunAddress,
  BunRuntime,
  HttpsOptions,
  ServeOptions,
};
