import type { ServerAdapter } from './server-adapter.ts';

/**
 * The application methods this adapter implements. Nest
 * declares them on its own platform interfaces, which an
 * application on Hono does not otherwise have.
 *
 * Every parameter type is read off `ServerAdapter` rather than
 * named again, and that is what keeps this file inside the
 * layer map: naming the view and static-asset option types
 * directly would draw a `core/` to `features/` edge, which only
 * the two composition roots may take, and `test/layers.test.ts`
 * refuses it. Deriving the types also keeps this surface from
 * drifting away from the methods it describes.
 *
 * The import above is what keeps this file a module rather than
 * a script: a `declare module` block in a file with no import
 * or export declares an ambient module, which would replace
 * Nest's own types instead of widening them.
 */
type StaticPaths = Parameters<
  ServerAdapter['useStaticAssets']
>[0];
type StaticOptions = Parameters<
  ServerAdapter['useStaticAssets']
>[1];
type ViewDirectories = Parameters<
  ServerAdapter['setBaseViewsDir']
>[0];
type ViewEngineName = Parameters<
  ServerAdapter['setViewEngine']
>[0];

declare module '@nestjs/common' {
  interface INestApplication<TServer> {
    /** Serves the files in a directory, at the prefix asked for. */
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
     * merged onto, the way Express's `app.locals` does. It
     * reaches the same context `defaultContext` fills at
     * construction.
     */
    setLocal: (key: string, value: unknown) => this;
    /**
     * Sets one of the settings this adapter honours. A name it
     * has no behaviour behind is refused rather than stored:
     * see `settable` in `core/hono-lifecycle.ts`.
     */
    set: (name: string, value: unknown) => this;
    /** Sets a setting to `true`, as Express's `enable` does. */
    enable: (name: string) => this;
    /** Sets a setting to `false`, as Express's `disable` does. */
    disable: (name: string) => this;
  }
}
