import type { MiddlewareHandler } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import type { StaticOptions, Transport } from '#adapter/core/ports/transport';
import { indexOf, setCacheControl, withoutPrefix } from '#adapter/features/static-assets/options';
import type { StaticAssetsOptions } from '#adapter/features/static-assets/options';

const mountsFor = (options: StaticAssetsOptions): readonly string[] => {
  const { prefix } = options;
  if (prefix === undefined || prefix === '') return ['/*'];

  // Hono's '/prefix/*' also matches '/prefix', so a bare mount only runs the handler twice.
  return [`${prefix}/*`];
};

const staticOptions = (directory: string, options: StaticAssetsOptions): StaticOptions => {
  const index = indexOf(options);
  const { prefix } = options;
  if (prefix === undefined) {
    return { index, root: directory };
  }
  return {
    index,
    rewriteRequestPath: (requestPath: string): string => withoutPrefix(requestPath, prefix),
    root: directory,
  };
};

const directoryHandler = (
  directory: string,
  transport: Transport,
  options: StaticAssetsOptions,
): MiddlewareHandler<NestEnv> => {
  const serve = transport.serveStatic(staticOptions(directory, options));

  return async (context, next) => {
    const found = await serve(context, next);
    if (found === undefined) return found;
    setCacheControl(found, options);

    return found;
  };
};

export { directoryHandler, mountsFor, staticOptions };
