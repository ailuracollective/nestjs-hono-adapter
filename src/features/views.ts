import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundException } from '@nestjs/common';

import type { NestContext } from '../core/context.ts';
import { toDirectories } from './static-assets.ts';

/** The data a template is rendered with. */
type ViewData = Record<string, unknown>;

/**
 * Renders a template's source into the answer.
 *
 * The engine is handed the source rather than a file name, so
 * every engine is reached the same way: the lines that compile
 * and run a template belong to the application, which already
 * knows which engine it uses.
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

function isRecord(value: unknown): value is ViewData {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/** The value a handler returned, as the object a template reads. */
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
 * Renders the templates a deployment configured.
 *
 * The engine is optional because an application that renders
 * nothing never configures one: naming an engine is what makes
 * it required, and that happens at startup rather than at the
 * first request that renders.
 */
class ViewRenderer {
  private readonly engine: ViewEngine | undefined;
  private directories: readonly string[] = [];
  private extension = '';

  public constructor(views: ViewOptions | undefined) {
    this.engine = engineOf(views);
    this.directories = directoriesOf(views);
  }

  /** Names the engine, by the extension it renders. */
  public useEngine(name: string): void {
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
    const html = await engine(source, asData(options));
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
export type { ViewData, ViewEngine, ViewOptions };
