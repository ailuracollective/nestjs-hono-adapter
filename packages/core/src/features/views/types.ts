/** The data a template is rendered with. */
type ViewData = Record<string, unknown>;

/** Renders a template's source into the answer. */
type ViewEngine = (
  source: string,
  data: ViewData,
) => string | Promise<string>;

/** The views a deployment configures. */
interface ViewOptions {
  readonly directory?: string | readonly string[];
  readonly engine: ViewEngine;
}

/** The view options a Fastify deployment is built with. */
interface ViewEngineOptions {
  readonly asyncProperyName?: string;
  readonly charset?: string;
  readonly defaultContext?: Record<string, unknown>;
  readonly engine?: Readonly<Record<string, unknown>>;
  readonly includeViewExtension?: boolean;
  readonly layout?: string;
  readonly maxCache?: number;
  readonly options?: object;
  readonly production?: boolean;
  readonly propertyName?: string;
  readonly root?: string;
  readonly templates?: string | readonly string[];
  readonly viewExt?: string;
}

/** What `setViewEngine()` takes. */
type EngineConfig = string | ViewEngineOptions;

export type {
  EngineConfig,
  ViewData,
  ViewEngine,
  ViewEngineOptions,
  ViewOptions,
};
