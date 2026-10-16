import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { NotFoundException } from '@nestjs/common';

const toExtension = (engine: string): string => {
  if (engine.startsWith('.')) {
    return engine;
  }

  return `.${engine}`;
};

const fileNameFor = (view: string, extension: string): string => {
  if (extension === '' || path.extname(view) !== '') {
    return view;
  }

  return `${view}${extension}`;
};

const isMissing = (error: unknown): boolean => {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  return Reflect.get(error, 'code') === 'ENOENT';
};

const readFrom = async (
  fileName: string,
  directories: readonly string[],
  position: number,
): Promise<string> => {
  const directory = directories[position];
  if (directory === undefined) {
    throw new NotFoundException(`No view named ${fileName} was found.`);
  }

  try {
    return await readFile(path.join(directory, fileName), 'utf8');
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
    return readFrom(fileName, directories, position + 1);
  }
};

// An Express engine reads the file itself, so it is handed the path rather than the source.
const locate = async (
  fileName: string,
  directories: readonly string[],
  position: number,
): Promise<string> => {
  const directory = directories[position];
  if (directory === undefined) {
    throw new NotFoundException(`No view named ${fileName} was found.`);
  }

  const candidate = path.join(directory, fileName);
  try {
    await stat(candidate);
    return candidate;
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
    return locate(fileName, directories, position + 1);
  }
};

export { fileNameFor, locate, readFrom, toExtension };
