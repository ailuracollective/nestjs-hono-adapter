import type { Transport } from '@ailura/nestjs-hono-adapter';

import { globalPrefixOf } from './global-prefix.ts';
import { indexPath } from './index-file-read.ts';
import { mountFallback } from './loader-fallback.ts';
import type { Mounting } from './loader-fallback.ts';
import { mountDirectory } from './loader-mount.ts';
import { resolve } from './loader-resolve.ts';
import type { Resolved } from './loader-resolve.ts';
import { assertNoHooks } from './options.ts';
import type { ServeStaticConfig } from './options.ts';
import type { Peers } from './peer-shapes.ts';
import type { Handler } from './mount-roots.ts';

interface LoaderAdapter {
  getHono: () => { use: (path: string, fn: Handler) => void };
  getTransport: () => Transport;
}

/**
 * The Hono-shaped stand-in for `@nestjs/serve-static`'s loader, which builds an Express router:
 * here the transport reads the
 */
class HonoServeStaticLoader {
  private readonly defaultRoot: string;

  private readonly peers: Peers;

  public constructor(peers: Peers, defaultRoot: string) {
    this.peers = peers;
    this.defaultRoot = defaultRoot;
  }

  public register(
    httpAdapter: LoaderAdapter,
    config: { getGlobalPrefix?: () => string | undefined },
    registrations: readonly ServeStaticConfig[],
  ): void {
    const mounting: Mounting = {
      app: httpAdapter.getHono(),
      peers: this.peers,
      transport: httpAdapter.getTransport(),
    };
    const prefix = globalPrefixOf(config);
    for (const options of registrations) {
      this.registerOne(mounting, options, resolve(options, this.defaultRoot, prefix));
    }
  }

  public getIndexFilePath(clientPath: string): string {
    return indexPath(clientPath);
  }

  private registerOne(mounting: Mounting, options: ServeStaticConfig, resolved: Resolved): void {
    assertNoHooks(options);
    mountDirectory(mounting, options, resolved);
    mountFallback(mounting, resolved);
  }
}

export { HonoServeStaticLoader };
export type { LoaderAdapter };
