import { toDirectories } from '#adapter/core/request/directories';
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
