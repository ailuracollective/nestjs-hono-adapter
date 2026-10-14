import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundException } from '@nestjs/common';

/** The extension a view engine names. */
const toExtension = (engine: string): string => {
  if (engine.startsWith('.')) {
    return engine;
  }

  return `.${engine}`;
};

/** The file a view name reads, completed with the extension. */
const fileNameFor = (
  view: string,
  extension: string,
): string => {
  if (extension === '' || path.extname(view) !== '') {
    return view;
  }

  return `${view}${extension}`;
};

/** Reads the first template that exists in the directories. */
const readFrom = async (
  fileName: string,
  directories: readonly string[],
  position: number,
): Promise<string> => {
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
    return readFrom(fileName, directories, position + 1);
  }
};

export { fileNameFor, readFrom, toExtension };
