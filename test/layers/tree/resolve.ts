import path from 'node:path';

import { ALIASES, CORE_ENTRY, CORE_PACKAGE } from '#test/layers/model';

const SPECIFIER =
  /^[ \t]*(?<statement>import|export)[ \t]+(?<typeOnly>type\b[ \t]*)?(?<bindings>[^;]*?)\bfrom\s+'(?<module>[^']+)'/gmu;

const moduleOf = (groups: Record<string, string> | undefined): string | undefined => {
  if (groups === undefined) return undefined;
  const { module = '' } = groups;
  if (module !== CORE_PACKAGE && !module.startsWith('.') && !module.startsWith('#')) {
    return undefined;
  }
  return module;
};

const aliasTarget = (module: string): string | undefined => {
  for (const [alias, tree] of Object.entries(ALIASES)) {
    if (module.startsWith(alias)) {
      // An alias carries no extension: the compiler refuses one on
      // a specifier it cannot rewrite, so the file is a `.ts`.
      return `${tree}${module.slice(alias.length)}.ts`;
    }
  }
  return undefined;
};

const typeOnlyOf = (groups: Record<string, string> | undefined): boolean => {
  if (groups === undefined) return false;
  return groups.typeOnly !== undefined;
};

const targetOf = (module: string, file: string): string | undefined => {
  if (module === CORE_PACKAGE) return CORE_ENTRY;
  if (module.startsWith('.')) {
    return path.join(path.dirname(file), module);
  }
  return aliasTarget(module);
};

export { SPECIFIER, aliasTarget, moduleOf, targetOf, typeOnlyOf };
