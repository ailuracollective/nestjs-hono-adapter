import { toDirectories } from '#adapter/core/request/directories';
import { rendererOf } from './engine-value.ts';
import { applyConfig, extensionFor } from './renderer/config.ts';
import { directoriesOf, engineOf } from './renderer/data.ts';
import { renderView } from './renderer/render.ts';
import { refusedField } from './options.ts';
import type { ViewState } from './renderer/data.ts';
import type { EngineConfig, ViewEngineOptions, ViewOptions } from './types.ts';

class ViewRenderer {
  private readonly state: ViewState = {
    context: {},
    defaults: {},
    directories: [],
    engine: undefined,
    engineName: undefined,
    engines: new Map(),
    extension: '',
  };

  public constructor(views: ViewOptions | undefined) {
    this.state.engine = engineOf(views);
    this.state.directories = directoriesOf(views);
  }

  public setLocal(key: string, value: unknown): void {
    Object.defineProperty(this.state.context, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  public useEngine(engine: EngineConfig): void {
    if (typeof engine === 'string') {
      this.state.extension = extensionFor(engine);
      if (this.state.engine === undefined) this.state.engineName = engine;
      return;
    }

    this.useOptions(engine);
  }

  public useDirectories(directory: string | readonly string[]): void {
    this.state.directories = toDirectories(directory);
  }

  // `app.engine(extension, engine)` — the Express selector, kept by extension so `render()` can pick
  // it for the template it resolved.
  public useEngineFor(extension: string, engine: unknown): void {
    const renderer = rendererOf(engine, 'file');
    if (renderer === undefined) {
      throw new TypeError(
        'engine() takes a template engine: (source, data) or (filePath, options, callback).',
      );
    }
    this.state.engines.set(extensionFor(extension), renderer);
  }

  public useOptions(options: ViewEngineOptions): void {
    const refused = refusedField(options);
    if (refused !== undefined) {
      throw new TypeError(`setViewEngine() cannot honour the ${refused} option.`);
    }

    this.apply(options);
  }

  private apply(options: ViewEngineOptions): void {
    applyConfig(this.state, options);
  }

  public render(view: string, options: unknown): Promise<string> {
    return renderView(view, options, this.state);
  }
}

export { ViewRenderer };
