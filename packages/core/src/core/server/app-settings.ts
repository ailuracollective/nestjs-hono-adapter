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

declare module '@nestjs/common' {
  /** The application methods this adapter implements. */
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
