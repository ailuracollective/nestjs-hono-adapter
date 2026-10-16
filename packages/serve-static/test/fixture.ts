import path from 'node:path';

import { Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

const ROOT = path.join(import.meta.dirname, 'fixtures');

interface StaticOptions {
  readonly setHeaders?: () => void;
  readonly serveRoot?: string;
}

/**
 * The module a case serves files from. It names the **stock** `ServeStaticModule`: the bridge
 * replaces the loader it builds, so a deployment installs the package and writes no import of it
 * anywhere.
 */
const staticModule = (options: StaticOptions = {}): Type<unknown> => {
  const { serveRoot = '/static', setHeaders } = options;
  @Module({
    imports: [
      ServeStaticModule.forRoot({
        rootPath: ROOT,
        serveRoot,
        serveStaticOptions: setHeaders === undefined ? {} : { setHeaders },
      }),
    ],
  })
  class StaticFixture {}

  return StaticFixture;
};

export { ROOT, staticModule };
export type { StaticOptions };
