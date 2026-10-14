import {
  PACKAGES,
  PLATFORM_PREFIX,
} from '#test/entry-points/packages';
import type { RuntimeManifest } from '#test/entry-points/packages';

import { entryPointName, sourceOf } from './walk.ts';

const OTHER_ENTRY_POINTS = PACKAGES.filter(
  (pkg) => pkg.name !== `${PLATFORM_PREFIX}socket-io`,
).flatMap((pkg) =>
  Object.entries(pkg.exports).map(
    ([subpath, target]) =>
      [
        entryPointName(pkg.name, subpath),
        sourceOf(pkg.dir, target.default),
      ] as const,
  ),
);

/** The names a manifest declares a deployment installs with it. */
const declaredBy = (manifest: RuntimeManifest): string[] => [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.optionalDependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];

/** The capability packages one manifest declares, itself aside. */
const capabilitiesDeclaredBy = (
  manifest: RuntimeManifest,
): string[] =>
  declaredBy(manifest).filter((name) =>
    name.startsWith(PLATFORM_PREFIX),
  );

export {
  OTHER_ENTRY_POINTS,
  capabilitiesDeclaredBy,
  declaredBy,
};
