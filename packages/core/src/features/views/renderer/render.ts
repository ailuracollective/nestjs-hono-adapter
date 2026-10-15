import path from 'node:path';
import { promisify } from 'node:util';

import { fileNameFor, locate, readFrom } from '#adapter/features/views/files';

import { asData, withDefaults } from './data.ts';
import { resolveEngine } from './engines.ts';

import type { ExpressViewEngine, Renderer, ViewData } from '#adapter/features/views/types';
import type { ViewState } from './data.ts';

const LEADING_DOT = /^\./u;

const directoriesFor = (directories: readonly string[]): readonly string[] => {
  if (directories.length === 0) return [process.cwd()];
  return directories;
};

const engineFor = async (state: ViewState, extension: string): Promise<Renderer> => {
  // An engine registered by extension — `app.engine('hbs', …)` — wins for that extension.
  const registered = state.engines.get(extension);
  if (registered !== undefined) return registered;
  if (state.engine === undefined && state.engineName !== undefined)
    state.engine = await resolveEngine(state.engineName);
  if (state.engine === undefined)
    throw new TypeError('No view engine was configured, so no view renders.');
  return state.engine;
};

// An Express engine is handed the app settings it reaches for (hbs reads `settings.views` to find
// its layout); the adapter's own selector renders from the source and needs none of that.
const settingsFor = (
  directories: readonly string[],
  extension: string,
): Record<string, unknown> => ({
  'view engine': extension.replace(LEADING_DOT, ''),
  views: directories,
});

const withSettings = (data: ViewData, settings: ViewData): ViewData =>
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- the locals plus the settings Express hands an engine.
  ({ ...data, settings });

const fromFile = async (engine: ExpressViewEngine, file: string, data: ViewData): Promise<string> =>
  String(await promisify(engine)(file, data));

const renderView = async (view: string, options: unknown, state: ViewState): Promise<string> => {
  const fileName = fileNameFor(view, state.extension);
  const extension = path.extname(fileName);
  const engine = await engineFor(state, extension);
  const directories = directoriesFor(state.directories);
  const data = withDefaults(state.defaults, state.context, asData(options));
  if (engine.kind === 'file') {
    const settings = settingsFor(directories, extension);
    return fromFile(
      engine.render,
      await locate(fileName, directories, 0),
      withSettings(data, settings),
    );
  }
  return engine.render(await readFrom(fileName, directories, 0), data);
};

export { renderView };
