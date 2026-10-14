import { applicationResolver } from './application-base.ts';
import type { Resolver } from './application-base.ts';

/** The `file:` URL a resolved path is imported by. */
const fileUrl = (path: string): string =>
  `file://${encodeURI(path)}`;

/** The URL an `import.meta.resolve` answers, or nothing. */
const metaUrl = (specifier: string): string | undefined => {
  try {
    return import.meta.resolve(specifier);
  } catch {
    return undefined;
  }
};

/** The URL the application's own resolver answers, or nothing. */
const applicationUrl = (
  specifier: string,
): string | undefined => {
  const resolve: Resolver | undefined = applicationResolver();
  if (resolve === undefined) {
    return undefined;
  }
  try {
    return fileUrl(resolve(specifier));
  } catch {
    return undefined;
  }
};

/**
 * What to try, in order. `import.meta.resolve` is asked first:
 * a `require` condition names the other build.
 */
const candidates = (specifier: string): readonly string[] => {
  const own = metaUrl(specifier);
  const application = applicationUrl(specifier);
  return [
    ...new Set(
      [application, own, specifier].filter(
        (url) => url !== undefined,
      ),
    ),
  ];
};

export { candidates };
