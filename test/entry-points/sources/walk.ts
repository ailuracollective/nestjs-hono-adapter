import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  namesIslandPeer,
  namesPackage,
  namesPackageAtRunTime,
  specifiersIn,
  targetOf,
} from './parse.ts';

const visit = async (file: string, seen: Set<string>): Promise<void> => {
  if (seen.has(file)) {
    return;
  }
  seen.add(file);
  const source = await readFile(file, 'utf8');
  const next = specifiersIn(source)
    .map((name) => targetOf(name, file))
    .filter((target): target is string => target !== undefined);
  await Promise.all(next.map((target) => visit(target, seen)));
};

const reachable = async (entry: string): Promise<string[]> => {
  const seen = new Set<string>();
  await visit(entry, seen);
  return [...seen];
};

const carriersOf = async (entry: string, packageName: string): Promise<string[]> => {
  const files = await reachable(entry);
  const checks = await Promise.all(files.map((file) => namesPackage(file, packageName)));
  return files.filter((_file, index) => checks[index] === true);
};

const peersReachedBy = async (entry: string): Promise<string[]> => {
  const files = await reachable(entry);
  const checks = await Promise.all(files.map((file) => namesIslandPeer(file)));
  return files.filter((_file, index) => checks[index] === true);
};

const runtimeCarriersOf = async (entry: string, packageName: string): Promise<string[]> => {
  const files = await reachable(entry);
  const checks = await Promise.all(files.map((file) => namesPackageAtRunTime(file, packageName)));
  return files.filter((_file, index) => checks[index] === true);
};

const entryPointName = (pkgName: string, subpath: string): string => {
  if (subpath === '.') return pkgName;
  return `${pkgName}${subpath.slice(1)}`;
};

const sourceOf = (dir: string, target: string): string => {
  const relative = target.replace(/^\.\/dist\//u, '').replace(/\.js$/u, '.ts');
  return path.resolve(import.meta.dirname, '..', '..', '..', dir, 'src', relative);
};

export { carriersOf, entryPointName, peersReachedBy, reachable, runtimeCarriersOf, sourceOf };
