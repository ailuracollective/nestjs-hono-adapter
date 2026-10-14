import { normaliseIndexType } from './mount-type.ts';
import type { ServeStaticConfig } from './options.ts';
import { staticOptionsOf } from './loader-resolve.ts';
import type { Resolved } from './loader-resolve.ts';
import type { Mounting } from './loader-fallback.ts';

/** Serves the directory itself, under its root. */
const mountDirectory = (
  mounting: Mounting,
  options: ServeStaticConfig,
  resolved: Resolved,
): void => {
  const { app, transport } = mounting;
  const { serveRoot } = resolved;
  const serving = normaliseIndexType(
    transport.serveStatic(staticOptionsOf(options, resolved)),
    resolved.fallthrough,
  );
  if (serveRoot === undefined) {
    app.use('*', serving);
    return;
  }
  app.use(serveRoot, serving);
  app.use(`${serveRoot}/*`, serving);
};

export { mountDirectory };
