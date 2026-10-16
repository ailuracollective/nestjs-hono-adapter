type ViewData = Record<string, unknown>;

// The adapter's own selector: the template source is read by the adapter and handed over.
type ViewEngine = (source: string, data: ViewData) => string | Promise<string>;

// The Express selector: `app.engine('hbs', hbs.__express)` — the engine reads the file itself and
// answers through the callback Express passes it.
type ExpressViewEngine = (
  filePath: string,
  options: ViewData,
  callback: (error: unknown, html?: string) => void,
) => void;

// Either selector, or a module carrying one of them as `render` (the `@fastify/view` shape).
type EngineValue =
  | ViewEngine
  | ExpressViewEngine
  | { readonly render: ViewEngine | ExpressViewEngine };

// What the renderer actually calls: the selector, and how the template reaches it.
type Renderer =
  | { readonly kind: 'source'; readonly render: ViewEngine }
  | { readonly kind: 'file'; readonly render: ExpressViewEngine };

interface ViewOptions {
  readonly directory?: string | readonly string[];
  readonly engine?: ViewEngine;
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

export type {
  EngineConfig,
  EngineValue,
  ExpressViewEngine,
  Renderer,
  ViewData,
  ViewEngine,
  ViewEngineOptions,
  ViewOptions,
};
