/** The options one `ServeStaticModule` registration carries. */
interface ServeStaticConfig {
  readonly exclude?: unknown;
  readonly renderPath?: string;
  readonly rootPath?: string;
  readonly serveRoot?: string;
  readonly serveStaticOptions?: {
    readonly fallthrough?: boolean;
    readonly index?: false | string;
    readonly setHeaders?: unknown;
  };
  readonly useGlobalPrefix?: boolean;
}

/**
 * The error for a hook the transport cannot honour:
 * `setHeaders` wants an `fs.Stats` no transport here builds.
 */
const unsupported = (name: string): TypeError =>
  new TypeError(
    'The Hono adapter cannot honour the static asset ' +
      `option ${name}.`,
  );

/** Refuses the hooks that would bind the loader to one runtime. */
const assertNoHooks = (options: ServeStaticConfig): void => {
  const { serveStaticOptions } = options;
  if (serveStaticOptions === undefined) {
    return;
  }
  if (serveStaticOptions.setHeaders !== undefined) {
    throw unsupported('setHeaders');
  }
};

export { assertNoHooks };
export type { ServeStaticConfig };
