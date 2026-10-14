import { toDirectories } from '#adapter/core/request/directories';
import {
  applyConfig,
  extensionFor,
} from './renderer/config.ts';
import { directoriesOf, engineOf } from './renderer/data.ts';
import { renderView } from './renderer/render.ts';
import { refusedField } from './options.ts';
import type { ViewState } from './renderer/data.ts';
import type {
  EngineConfig,
  ViewEngineOptions,
  ViewOptions,
} from './types.ts';

/** Renders configured templates. */
class ViewRenderer {
  /** The fields every render reads. */
  private readonly state: ViewState = {
    context: {},
    defaults: {},
    directories: [],
    engine: undefined,
    extension: '',
  };

  /** Builds the renderer on the views a deployment configured. */
  public constructor(views: ViewOptions | undefined) {
    this.state.engine = engineOf(views);
    this.state.directories = directoriesOf(views);
  }

  /** Adds one value to the data every render is merged onto. */
  public setLocal(key: string, value: unknown): void {
    Object.defineProperty(this.state.context, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  /** Configures the views, by name or by Fastify's own options. */
  public useEngine(engine: EngineConfig): void {
    if (typeof engine === 'string') {
      this.state.extension = extensionFor(
        this.state.engine,
        engine,
      );
      return;
    }

    this.useOptions(engine);
  }

  /** Names the directories a view is read from. */
  public useDirectories(
    directory: string | readonly string[],
  ): void {
    this.state.directories = toDirectories(directory);
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
    applyConfig(this.state, options);
  }

  /** Renders one view and answers the HTML it produced. */
  public render(
    view: string,
    options: unknown,
  ): Promise<string> {
    return renderView(view, options, this.state);
  }
}

export { ViewRenderer };
