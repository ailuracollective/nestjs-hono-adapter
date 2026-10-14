import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { ROOT } from '#test/layers/model';
import type { Edge } from '#test/layers/model';

import { SPECIFIER, moduleOf, targetOf, typeOnlyOf } from './resolve.ts';

const sourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => sourceFiles(path.join(directory, entry.name))),
  );
  const here = entries
    .filter((entry) => !entry.isDirectory() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(directory, entry.name));
  return [...nested.flat(), ...here];
};

const edgesIn = (source: string, file: string): Edge[] => {
  const found: Edge[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const { bindings = '', statement = '' } = match.groups ?? {};
    const module = moduleOf(match.groups);
    const target = module === undefined ? undefined : targetOf(module, file);
    if (target !== undefined) {
      found.push({
        from: file,
        markerOnly:
          statement === 'import' &&
          /^\s*\{\s*declareMultipart(?:\s+as\s+[\w$]+)?\s*,?\s*\}\s*$/u.test(bindings),
        to: target,
        typeOnly: typeOnlyOf(match.groups),
      });
    }
  }
  return found;
};

const edgesFrom = async (file: string): Promise<Edge[]> => {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  return edgesIn(source, file);
};

const readTree = async (root: string): Promise<string[]> => {
  try {
    const files = await sourceFiles(root);
    return files.map((file) => path.relative(ROOT, file));
  } catch (error) {
    throw new Error(`the walk of ${root} read nothing: ${String(error)}`, {
      cause: error,
    });
  }
};

export { edgesFrom, edgesIn, readTree, sourceFiles };
