import path from 'node:path';

import { BRIDGE_ENTRYPOINTS, REQUIRED, ROOT, SOURCE } from '#test/layers/model';
import type { Edge } from '#test/layers/model';

import { edgesFrom, readTree } from './edges.ts';

const scan = async (root: string, expected: readonly string[] = REQUIRED): Promise<Edge[]> => {
  const files = await readTree(root);
  const missing = expected.filter((name) => !files.includes(name));
  if (missing.length > 0) {
    throw new Error(`the walk of ${root} found no ${missing.join(', ')}`);
  }
  const edges = await Promise.all(files.map((file) => edgesFrom(file)));
  return edges.flat();
};
const bridgeTrees = async (): Promise<Edge[]> => {
  const trees = await Promise.all(
    Object.entries(BRIDGE_ENTRYPOINTS).map(([name, expected]) =>
      scan(path.join(ROOT, 'packages', name, 'src'), expected),
    ),
  );
  return trees.flat();
};

const scanAll = async (): Promise<Edge[]> => [
  ...(await scan(SOURCE)),
  ...(await scan(path.join(ROOT, 'packages', 'ws', 'src'), [])),
  ...(await scan(path.join(ROOT, 'packages', 'socket-io', 'src'), [])),
  ...(await scan(path.join(ROOT, 'packages', 'multipart', 'src'), [])),
  ...(await bridgeTrees()),
];

const refusalOf = async (root: string): Promise<string> => {
  try {
    await scan(root);
  } catch (error) {
    return String(error);
  }
  return '';
};

export { refusalOf, scan, scanAll };
