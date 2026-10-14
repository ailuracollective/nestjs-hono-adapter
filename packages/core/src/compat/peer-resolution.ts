import { applicationResolver } from './application-base.ts';
import type { Resolver } from './application-base.ts';

const fileUrl = (path: string): string => `file://${encodeURI(path)}`;

const metaUrl = (specifier: string): string | undefined => {
  try {
    return import.meta.resolve(specifier);
  } catch {
    return undefined;
  }
};

const applicationUrl = (specifier: string): string | undefined => {
  const resolve: Resolver | undefined = applicationResolver();
  if (resolve === undefined) return undefined;
  try {
    return fileUrl(resolve(specifier));
  } catch {
    return undefined;
  }
};

/**
 * What to try, in order. `import.meta.resolve` is asked first: a `require` condition names the
 * other build.
 */
const candidates = (specifier: string): readonly string[] => {
  const own = metaUrl(specifier);
  const application = applicationUrl(specifier);
  return [...new Set([application, own, specifier].filter((url) => url !== undefined))];
};

export { candidates };
