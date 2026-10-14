import type { NestHono } from '#adapter/core/context';
import type { Transport } from '#adapter/core/ports/transport';
import { toDirectories } from '#adapter/core/request/directories';
import type {
  StaticAssetsOptions,
  StaticAssetsTarget,
} from '#adapter/features/static-assets/options';

/** What one directory is served from, as the transport reads it. */
interface StaticTarget {
  readonly hono: NestHono;
  readonly transport: Transport;
  /** What the call named first, in either transport's form. */
  readonly path?: StaticAssetsTarget;
  /** What the call named second, which is Express's form. */
  readonly options?: StaticAssetsOptions | undefined;
}

/** Whether a call names its directories first, as Express does. */
const namesPathFirst = (
  path: StaticAssetsTarget,
): path is string | readonly string[] =>
  typeof path === 'string' || Array.isArray(path);

/** The directories a call named, in either transport's form. */
const directoriesOf = (
  target: StaticTarget,
): readonly string[] => {
  const { path } = target;
  if (path === undefined) {
    return [];
  }
  if (namesPathFirst(path)) {
    return toDirectories(path);
  }
  if (path.root === undefined) {
    return [];
  }

  return toDirectories(path.root);
};

/** The options a call named, in either transport's form. */
const optionsOf = (
  target: StaticTarget,
): StaticAssetsOptions => {
  const { options, path } = target;
  if (options !== undefined) {
    return options;
  }
  if (path === undefined || namesPathFirst(path)) {
    return {};
  }

  return path;
};

export { directoriesOf, namesPathFirst, optionsOf };
export type { StaticTarget };
