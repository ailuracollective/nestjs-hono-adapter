import path from 'node:path';

import { Module } from '@nestjs/common';
import { InertiaModule } from '@dudousxd/nestjs-inertia';
import type { ShellRenderCtx } from '@dudousxd/nestjs-inertia';

import { BenchController } from './bench.controller.ts';

const ssrRootView = (ctx: ShellRenderCtx): string => {
  const head = ctx.ssr === null ? '' : ctx.ssr.head.join('');
  const body = ctx.ssr === null ? '<div id="app"></div>' : ctx.ssr.body;
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
};

const reactBundle = path.join(import.meta.dirname, 'ssr', 'react.js');
const vueBundle = path.join(import.meta.dirname, 'ssr', 'vue.js');

/** Root Nest module for the benchmark application. */
@Module({
  controllers: [BenchController],
  imports: [
    InertiaModule.forRoot({ version: 'bench' }),
    InertiaModule.forFeature({
      rootView: ssrRootView,
      scope: 'react',
      ssr: { bundlePath: reactBundle, enabled: true },
      version: 'react-bench',
    }),
    InertiaModule.forFeature({
      rootView: ssrRootView,
      scope: 'vue',
      ssr: { bundlePath: vueBundle, enabled: true },
      version: 'vue-bench',
    }),
  ],
})
export class BenchModule {}
