import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DYNAMIC_SPECIFIER,
  ISLAND_PEERS,
  SPECIFIER,
  TYPE_STATEMENT,
} from '#test/entry-points/packages';
import { ALIASES, ROOT } from '#test/layers/model';

const moduleOf = (
  groups: Record<string, string> | undefined,
): string | undefined => {
  if (groups === undefined) {
    return undefined;
  }
  return groups.module;
};

/** The modules a source file names. */
const specifiersIn = (source: string): string[] => {
  const names: string[] = [];
  for (const pattern of [SPECIFIER, DYNAMIC_SPECIFIER]) {
    for (const match of source.matchAll(pattern)) {
      const module = moduleOf(match.groups);
      if (module !== undefined) {
        names.push(module);
      }
    }
  }
  return names;
};

/** Says whether a module name is, or belongs to, a package. */
const belongsTo = (
  name: string,
  packageName: string,
): boolean =>
  name === packageName || name.startsWith(`${packageName}/`);

/** Says whether one file names a package. */
const namesPackage = async (
  file: string,
  packageName: string,
): Promise<boolean> => {
  const source = await readFile(file, 'utf8');
  return specifiersIn(source).some((name) =>
    belongsTo(name, packageName),
  );
};

/** The modules a source file names in its value imports. */
const valueSpecifiersIn = (source: string): string[] =>
  specifiersIn(source.replace(TYPE_STATEMENT, ''));

/** Says whether one file names a package at run time. */
const namesPackageAtRunTime = async (
  file: string,
  packageName: string,
): Promise<boolean> => {
  const source = await readFile(file, 'utf8');
  return valueSpecifiersIn(source).some((name) =>
    belongsTo(name, packageName),
  );
};

/** Says whether one file names a package only the island may. */
const namesIslandPeer = async (
  file: string,
): Promise<boolean> => {
  const source = await readFile(file, 'utf8');
  return specifiersIn(source).some((name) =>
    ISLAND_PEERS.some((peer) => belongsTo(name, peer)),
  );
};

/** The file an alias names, and none when no alias does. */
const aliasFile = (name: string): string | undefined => {
  for (const [alias, tree] of Object.entries(ALIASES)) {
    if (name.startsWith(alias)) {
      return path.join(
        ROOT,
        `${tree}${name.slice(alias.length)}.ts`,
      );
    }
  }
  return undefined;
};

/**
 * The file one specifier names, and none when the walk stops
 * there.
 */
const targetOf = (
  name: string,
  from: string,
): string | undefined => {
  if (name.startsWith('.')) {
    return path.join(path.dirname(from), name);
  }
  return name.startsWith('#') ? aliasFile(name) : undefined;
};

/** Follows one file's relative and aliased imports. */

export {
  namesIslandPeer,
  namesPackage,
  namesPackageAtRunTime,
  specifiersIn,
  targetOf,
  valueSpecifiersIn,
};
