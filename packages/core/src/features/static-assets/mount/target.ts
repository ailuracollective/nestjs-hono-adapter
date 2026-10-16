import type { NestHono } from '#adapter/core/context';
import type { Transport } from '#adapter/core/ports/transport';
import { toDirectories } from '#adapter/core/request/directories';
import type {
  StaticAssetsOptions,
  StaticAssetsTarget,
} from '#adapter/features/static-assets/options';

interface StaticTarget {
  readonly hono: NestHono;
  readonly transport: Transport;
  readonly path?: StaticAssetsTarget;
  readonly options?: StaticAssetsOptions | undefined;
}

const namesPathFirst = (path: StaticAssetsTarget): path is string | readonly string[] =>
  typeof path === 'string' || Array.isArray(path);

const directoriesOf = (target: StaticTarget): readonly string[] => {
  const { path } = target;
  if (path === undefined) return [];
  if (namesPathFirst(path)) {
    return toDirectories(path);
  }
  if (path.root === undefined) return [];

  return toDirectories(path.root);
};

const optionsOf = (target: StaticTarget): StaticAssetsOptions => {
  const { options, path } = target;
  if (options !== undefined) return options;
  if (path === undefined || namesPathFirst(path)) {
    return {};
  }

  return path;
};

export { directoriesOf, namesPathFirst, optionsOf };
export type { StaticTarget };
