import type { Server as NativeServer } from 'node:http';
import type { INestApplication } from '@nestjs/common';

import type { InjectRunner } from '#adapter/core/inject/types';
import type { Server } from '#adapter/core/ports/server';
import type { NestHono } from '#adapter/core/context';
import type { ServerAdapter } from './server-adapter.ts';

type StaticPaths = Parameters<ServerAdapter['useStaticAssets']>[0];
type StaticOptions = Parameters<ServerAdapter['useStaticAssets']>[1];
type ViewDirectories = Parameters<ServerAdapter['setBaseViewsDir']>[0];
type ViewEngineName = Parameters<ServerAdapter['setViewEngine']>[0];

interface NestHonoApplication extends INestApplication<Server & NativeServer> {
  getHttpAdapter: () => ServerAdapter;
  inject: InjectRunner;
}

declare module '@nestjs/common' {
  interface HttpServer<TRequest, TResponse, ServerInstance> {
    getHono: () => NestHono;
  }

  /**
   * The application methods this adapter implements, so the app is read like
   * `NestExpressApplication`.
   */
  interface INestApplication<TServer> {
    useStaticAssets: (path: StaticPaths, options?: StaticOptions) => this;
    setBaseViewsDir: (directory: ViewDirectories) => this;
    setViewEngine: (engine: ViewEngineName) => this;
    setLocal: (key: string, value: unknown) => this;
    set: (name: string, value: unknown) => this;
    enable: (name: string) => this;
    disable: (name: string) => this;
  }
}

export type { NestHonoApplication };
