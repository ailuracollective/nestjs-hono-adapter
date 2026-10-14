import {
  assertDirectories,
  assertNoHooks,
  assertNoOtherModes,
} from '#adapter/features/static-assets/options';

import { directoryHandler, mountsFor } from './handlers.ts';
import { directoriesOf, optionsOf } from './target.ts';
import type { StaticTarget } from './target.ts';

/** Mounts the directories a deployment named, under its prefix. */
const mountStaticAssets = (target: StaticTarget): void => {
  const { hono, transport } = target;
  const directories = directoriesOf(target);
  const options = optionsOf(target);
  assertNoHooks(options);
  assertNoOtherModes(options);
  assertDirectories(directories);

  for (const directory of directories) {
    for (const mount of mountsFor(options)) {
      hono.use(
        mount,
        directoryHandler(directory, transport, options),
      );
    }
  }
};

export { mountStaticAssets };
