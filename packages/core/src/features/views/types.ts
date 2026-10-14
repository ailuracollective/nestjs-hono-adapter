type ViewData = Record<string, unknown>;

type ViewEngine = (source: string, data: ViewData) => string | Promise<string>;

interface ViewOptions {
  readonly directory?: string | readonly string[];
  readonly engine: ViewEngine;
}

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

type EngineConfig = string | ViewEngineOptions;

export type { EngineConfig, ViewData, ViewEngine, ViewEngineOptions, ViewOptions };
