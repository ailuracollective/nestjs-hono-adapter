import { stat } from 'node:fs/promises';
import nodePath from 'node:path';

import type { MiddlewareHandler } from 'hono';
import { serveStatic as baseServeStatic } from 'hono/serve-static';

import type { NestEnv } from '#adapter/core/context';
import type { StaticOptions } from '#adapter/core/ports/transport';

/** What the Hono middleware reads as "no file here". */
// oxlint-disable-next-line unicorn/no-null -- the middleware signals "not found" with a null answer.
const NOT_FOUND = null;

/** The file a path names, or nothing when there is none. */
const readContent = async (
  target: string,
): Promise<Response | null> => {
  const file = Bun.file(target);
  const found = await file.exists();
  if (!found) {
    return NOT_FOUND;
  }
  return file as unknown as Response;
};

/** The content of the file a path names, or its index file. */
const contentOf = async (
  filePath: string,
  index: string,
): Promise<Response | null> => {
  try {
    const stats = await stat(filePath);
    if (!stats.isDirectory()) {
      return await readContent(filePath);
    }
    return await readContent(nodePath.join(filePath, index));
  } catch {
    return NOT_FOUND;
  }
};

/** The middleware that serves one directory with `Bun.file`. */
const bunServeStatic = (
  options: StaticOptions,
): MiddlewareHandler<NestEnv> => {
  const config: Record<string, unknown> = {
    getContent: (filePath: string) =>
      contentOf(filePath, options.index),
    isDir: (): boolean => false,
    join: (...parts: string[]) => nodePath.join(...parts),
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined) {
    config.rewriteRequestPath = options.rewriteRequestPath;
  }
  return baseServeStatic<NestEnv>(
    config as unknown as Parameters<
      typeof baseServeStatic<NestEnv>
    >[0],
  );
};

export { bunServeStatic };
