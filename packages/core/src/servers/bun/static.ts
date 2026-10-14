import { stat } from 'node:fs/promises';
import nodePath from 'node:path';

import type { MiddlewareHandler } from 'hono';
import { serveStatic as baseServeStatic } from 'hono/serve-static';

import type { NestEnv } from '#adapter/core/context';
import type { StaticOptions } from '#adapter/core/ports/transport';

// oxlint-disable-next-line unicorn/no-null -- the middleware signals "not found" with a null answer.
const NOT_FOUND = null;

const readContent = async (target: string): Promise<Response | null> => {
  const file = Bun.file(target);
  const found = await file.exists();
  if (!found) return NOT_FOUND;
  return file as unknown as Response;
};

const isMissing = (error: unknown): boolean => {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  return Reflect.get(error, 'code') === 'ENOENT';
};

const contentOf = async (filePath: string, index: string): Promise<Response | null> => {
  try {
    const stats = await stat(filePath);
    if (!stats.isDirectory()) {
      return await readContent(filePath);
    }
    return await readContent(nodePath.join(filePath, index));
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
    return NOT_FOUND;
  }
};

const bunServeStatic = (options: StaticOptions): MiddlewareHandler<NestEnv> => {
  const config: Record<string, unknown> = {
    getContent: (filePath: string) => contentOf(filePath, options.index),
    isDir: (): boolean => false,
    join: (...parts: string[]) => nodePath.join(...parts),
    root: options.root,
  };
  if (options.rewriteRequestPath !== undefined)
    config.rewriteRequestPath = options.rewriteRequestPath;
  return baseServeStatic<NestEnv>(
    config as unknown as Parameters<typeof baseServeStatic<NestEnv>>[0],
  );
};

export { bunServeStatic };
