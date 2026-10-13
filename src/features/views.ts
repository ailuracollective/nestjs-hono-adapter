import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundException } from '@nestjs/common';

import type { NestContext } from '../core/context.ts';
import { toDirectories } from '../core/directories.ts';
import { isRecord } from '../core/query.ts';

/** The data a template is rendered with. */
type ViewData = Record<string, unknown>;

/**
 * Renders a template's source into the answer. The engine is
 * handed the source rather than a file name, so every engine is
 * reached the same way and the lines that compile a template
 * belong to the application, which knows which engine it uses.
 */
type ViewEngine = (
  source: string,
  data: ViewData,
) => string | Promise<string>;

/** The views a deployment configures. */
interface ViewOptions {
  readonly directory?: string | readonly string[];
  readonly engine: ViewEngine;
}

/**
 * The view configuration a Fastify deployment is built with,
 * declared here because this adapter has no Fastify to take the
 * type from. The fields it has no counterpart for are refused
 * rather than ignored, so a deployment finds out at startup
 * instead of from a quietly different answer.
 */
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

/**
 * What `setViewEngine()` takes: the extension Express names, or
 * the options object Fastify takes.
 */
type EngineConfig = string | ViewEngineOptions;

/** The fields of such a configuration this adapter reads. */
const VIEW_FIELDS = new Set([
  'defaultContext',
  'engine',
  'includeViewExtension',
  'maxCache',
  'production',
  'root',
  'templates',
  'viewExt',
]);

/**
 * The value a handler returned, as the object a template reads.
 * A handler returning nothing yields an empty object rather
 * than a refusal: what an absent variable means is the
 * template's decision, not the adapter's.
 */
function asData(options: unknown): ViewData {
  if (isRecord(options)) {
    return options;
  }

  return {};
}

/** The engine a deployment configured, when it configured one. */
function engineOf(
  views: ViewOptions | undefined,
): ViewEngine | undefined {
  if (views === undefined) {
    return undefined;
  }

  return views.engine;
}

/** The directories a deployment configured, when it named any. */
function directoriesOf(
  views: ViewOptions | undefined,
): readonly string[] {
  if (views === undefined) {
    return [];
  }

  const { directory } = views;
  if (directory === undefined) {
    return [];
  }

  return toDirectories(directory);
}

/**
 * The first field of such a configuration that cannot be
 * honoured.
 */
function refusedField(
  options: ViewEngineOptions,
): string | undefined {
  for (const name of Object.keys(options)) {
    if (!VIEW_FIELDS.has(name)) {
      return name;
    }
  }

  return undefined;
}

/** The directories such a configuration names. */
function directoriesFrom(
  options: ViewEngineOptions,
): readonly string[] {
  const { root, templates } = options;
  if (root !== undefined) {
    return [root];
  }
  if (templates === undefined) {
    return [];
  }

  return toDirectories(templates);
}

/** Whether an engine is the renderer this adapter calls. */
function isEngine(value: unknown): value is ViewEngine {
  return typeof value === 'function';
}

/** Whether an engine renders from the source, as `render` does. */
function isRenderEngine(
  value: unknown,
): value is { render: ViewEngine } {
  return isRecord(value) && typeof value.render === 'function';
}

/** The one renderer such a configuration names. */
function namedEngine(
  engines: Readonly<Record<string, unknown>>,
): unknown {
  const named = Object.values(engines);
  if (named.length !== 1) {
    throw new TypeError(
      'setViewEngine() renders with one engine, so name one.',
    );
  }

  return named[0];
}

/** The renderer a named engine is, when it renders from source. */
function asEngine(engine: unknown): ViewEngine {
  if (isEngine(engine)) {
    return engine;
  }
  if (isRenderEngine(engine)) {
    return (
      source: string,
      data: ViewData,
    ): string | Promise<string> => engine.render(source, data);
  }

  throw new TypeError(
    'setViewEngine() renders from the template source, so an ' +
      'engine must be a function of (source, data) or expose ' +
      'that as render().',
  );
}

/**
 * The renderer such a configuration names. The adapter renders
 * from the template's source rather than from its path, so an
 * engine is read when it is that function or exposes one.
 */
function engineFrom(
  engines: Readonly<Record<string, unknown>> | undefined,
): ViewEngine | undefined {
  if (engines === undefined) {
    return undefined;
  }

  return asEngine(namedEngine(engines));
}

/**
 * Defaults, then locals, then the handler's data, which wins.
 * Spreading keeps special keys such as `__proto__` as own
 * data.
 */
function withDefaults(
  defaults: ViewData,
  locals: ViewData,
  data: ViewData,
): ViewData {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- object spread defines own data properties without invoking the __proto__ setter.
  return { ...defaults, ...locals, ...data };
}

/** The extension a view engine names. */
function toExtension(engine: string): string {
  if (engine.startsWith('.')) {
    return engine;
  }

  return `.${engine}`;
}

/** The file a view name reads, completed with the extension. */
function fileNameFor(view: string, extension: string): string {
  if (extension === '' || path.extname(view) !== '') {
    return view;
  }

  return `${view}${extension}`;
}

/** Reads the first template that exists in the directories. */
async function readFrom(
  fileName: string,
  directories: readonly string[],
  position: number,
): Promise<string> {
  const directory = directories[position];
  if (directory === undefined) {
    throw new NotFoundException(
      `No view named ${fileName} was found.`,
    );
  }

  try {
    return await readFile(
      path.join(directory, fileName),
      'utf8',
    );
  } catch {
    // The next directory may hold it; the last one reports.
    return readFrom(fileName, directories, position + 1);
  }
}

/**
 * Renders configured templates. Naming an engine requires one
 * at startup; applications that render nothing need none.
 */
class ViewRenderer {
  private engine: ViewEngine | undefined;
  private directories: readonly string[] = [];
  private extension = '';
  private defaults: ViewData = {};
  private readonly context: ViewData = {};

  public constructor(views: ViewOptions | undefined) {
    this.engine = engineOf(views);
    this.directories = directoriesOf(views);
  }

  /** Adds one value to the data every render is merged onto. */
  public setLocal(key: string, value: unknown): void {
    Object.defineProperty(this.context, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  /** Configures the views, by name or by Fastify's own options. */
  public useEngine(engine: EngineConfig): void {
    if (typeof engine === 'string') {
      this.nameEngine(engine);
      return;
    }

    this.useOptions(engine);
  }

  /** Names the engine, by the extension it renders. */
  private nameEngine(name: string): void {
    if (this.engine === undefined) {
      throw new TypeError(
        'The adapter renders with the engine it was given, so ' +
          'pass `views.engine` before naming one.',
      );
    }

    this.extension = toExtension(name);
  }

  /** Names the directories a view is read from. */
  public useDirectories(
    directory: string | readonly string[],
  ): void {
    this.directories = toDirectories(directory);
  }

  /** Configures the views the way Fastify is configured. */
  public useOptions(options: ViewEngineOptions): void {
    const refused = refusedField(options);
    if (refused !== undefined) {
      throw new TypeError(
        `setViewEngine() cannot honour the ${refused} option.`,
      );
    }

    this.apply(options);
  }

  /** Reads the fields such a configuration names onto the views. */
  private apply(options: ViewEngineOptions): void {
    const engine = engineFrom(options.engine);
    if (engine !== undefined) {
      this.engine = engine;
    }
    const directories = directoriesFrom(options);
    if (directories.length > 0) {
      this.directories = directories;
    }

    this.applyNames(options);
  }

  /** Reads the names such a configuration carries. */
  private applyNames(options: ViewEngineOptions): void {
    if (options.viewExt !== undefined) {
      this.extension = toExtension(options.viewExt);
    }
    if (options.defaultContext !== undefined) {
      this.defaults = options.defaultContext;
    }
  }

  /** Renders one view into the response Nest handed over. */
  public async render(
    response: NestContext,
    view: string,
    options: unknown,
  ): Promise<void> {
    const { engine } = this;
    if (engine === undefined) {
      throw new TypeError(
        'No view engine was configured, so no view renders.',
      );
    }

    const fileName = fileNameFor(view, this.extension);
    const source = await readFrom(
      fileName,
      this.directoriesFor(),
      0,
    );
    const html = await engine(
      source,
      withDefaults(
        this.defaults,
        this.context,
        asData(options),
      ),
    );
    response.html(html);
  }

  /** The directories to read from, the working one by default. */
  private directoriesFor(): readonly string[] {
    if (this.directories.length === 0) {
      return [process.cwd()];
    }

    return this.directories;
  }
}

export { ViewRenderer };
export type {
  EngineConfig,
  ViewData,
  ViewEngine,
  ViewEngineOptions,
  ViewOptions,
};
