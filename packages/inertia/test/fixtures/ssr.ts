import path from 'node:path';

import { Controller, Get, Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { Inertia, InertiaModule } from '@dudousxd/nestjs-inertia';
import type { ShellRenderCtx } from '@dudousxd/nestjs-inertia';

const BUFFERED = path.join(import.meta.dir, 'ssr-bundle.ts');
const STREAMING = path.join(import.meta.dir, 'ssr-stream-bundle.ts');

const rootView = (ctx: ShellRenderCtx): string => {
  const head = ctx.ssr === null ? '' : ctx.ssr.head.join('');
  const body = ctx.ssr === null ? '<div id="app"></div>' : ctx.ssr.body;
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
};

@Controller()
class SsrController {
  @Get('/ssr')
  @Inertia('Ssr/Index')
  public ssr(): { message: string } {
    return { message: 'ssr' };
  }
}

const ssrModule = (): Type<unknown> => {
  @Module({
    controllers: [SsrController],
    imports: [
      InertiaModule.forRoot({
        rootView,
        ssr: { bundlePath: BUFFERED, enabled: true },
        version: 'v1',
      }),
    ],
  })
  class SsrFixture {}

  return SsrFixture;
};

const ssrStreamModule = (): Type<unknown> => {
  @Module({
    controllers: [SsrController],
    imports: [
      InertiaModule.forRoot({
        ssr: { bundlePath: STREAMING, enabled: true, streaming: true },
        version: 'v1',
      }),
    ],
  })
  class SsrStreamFixture {}

  return SsrStreamFixture;
};

export { ssrModule, ssrStreamModule };
