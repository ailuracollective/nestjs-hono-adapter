import { HonoServeStaticLoader } from './loader.ts';
import { rootPath, serveStaticModule } from './peer-read.ts';
import type { Peers, ServeStaticInstance } from './peer-shapes.ts';

const fitted = new WeakSet<object>();

const platformOf = (instance: ServeStaticInstance): (() => string) | undefined => {
  const host = instance.httpAdapterHost;
  if (host === undefined) return undefined;
  const { httpAdapter } = host;
  if (httpAdapter === undefined) return undefined;
  return httpAdapter.getType;
};

const isOnHono = (instance: ServeStaticInstance): boolean => {
  const type = platformOf(instance);
  if (type === undefined) return false;
  return type() === 'hono';
};

/**
 * Hands a Hono adapter the transport-backed loader, and leaves the module's own loader in place for
 * every other platform.
 */
const replacedInit = (instance: ServeStaticInstance, peers: Peers): boolean => {
  if (!isOnHono(instance)) {
    return false;
  }
  instance.loader = new HonoServeStaticLoader(peers, rootPath(peers));
  return true;
};

const swapLoader = (peers: Peers): void => {
  const module = serveStaticModule(peers);
  if (module === undefined || fitted.has(module)) {
    return;
  }
  fitted.add(module);
  const original = module.prototype.onModuleInit;
  function patched(this: ServeStaticInstance): unknown {
    const replaced = replacedInit(this, peers);
    const inherited = original === undefined ? undefined : original.call(this);
    return replaced ? undefined : inherited;
  }
  module.prototype.onModuleInit = patched;
};

export { swapLoader };
