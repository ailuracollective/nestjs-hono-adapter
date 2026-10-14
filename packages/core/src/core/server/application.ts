import type { Server as NativeServer } from 'node:http';
import type { INestApplication } from '@nestjs/common';

import type { InjectRunner } from '#adapter/core/inject/types';
import type { Server } from '#adapter/core/ports/server';
import type { NestHono } from '#adapter/core/context';
import type { ServerAdapter } from './server-adapter.ts';

/** The paths `useStaticAssets` accepts. */
type StaticPaths = Parameters<
  ServerAdapter['useStaticAssets']
>[0];
/** The options `useStaticAssets` accepts. */
type StaticOptions = Parameters<
  ServerAdapter['useStaticAssets']
>[1];
/** The directories `setBaseViewsDir` accepts. */
type ViewDirectories = Parameters<
  ServerAdapter['setBaseViewsDir']
>[0];
/** The engine name `setViewEngine` accepts. */
type ViewEngineName = Parameters<
  ServerAdapter['setViewEngine']
>[0];

/**
 * The application `NestFactory.create()` hands back with this
 * adapter.
 */
interface NestHonoApplication extends INestApplication<
  Server & NativeServer
> {
  /** The adapter itself, rather than the shared contract. */
  getHttpAdapter: () => ServerAdapter;
  /** Answers a request inside the process, without a port. */
  inject: InjectRunner;
}

declare module '@nestjs/common' {
  /** The Hono accessor this adapter adds to the shared contract. */
  interface HttpServer<TRequest, TResponse, ServerInstance> {
    /** The Hono application behind this adapter. */
    getHono: () => NestHono;
  }

  /**
   * The application methods this adapter implements, so the app
   * is read like `NestExpressApplication`.
   */
  interface INestApplication<TServer> {
    /** Serves the files in a directory at the prefix asked for. */
    useStaticAssets: (
      path: StaticPaths,
      options?: StaticOptions,
    ) => this;
    /** Names the directories a view is read from. */
    setBaseViewsDir: (directory: ViewDirectories) => this;
    /** Names the view engine, by the extension it renders. */
    setViewEngine: (engine: ViewEngineName) => this;
    /**
     * Adds one value to the data every template render is
     * merged onto.
     */
    setLocal: (key: string, value: unknown) => this;
    /** Sets one of the settings this adapter honours. */
    set: (name: string, value: unknown) => this;
    /** Sets a setting to `true`. */
    enable: (name: string) => this;
    /** Sets a setting to `false`. */
    disable: (name: string) => this;
  }
}

export type { NestHonoApplication };
