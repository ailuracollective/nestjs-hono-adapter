import {
  DEFAULT_EXPRESS_RENDER_PATH,
  DEFAULT_ROOT_PATH,
} from './peer-shapes.ts';
import type {
  NotFoundShape,
  PathToRegexpShape,
  PeerModule,
  Peers,
  ServeStaticShape,
} from './peer-shapes.ts';

/** Whether a loaded module carries a callable member by name. */
const hasFunction = (loaded: unknown, name: string): boolean =>
  typeof loaded === 'object' &&
  loaded !== null &&
  typeof Reflect.get(loaded, name) === 'function';

/** The `path-to-regexp` peer, when the loaded module is one. */
const isMatcherPeer = (
  loaded: unknown,
): loaded is PathToRegexpShape =>
  hasFunction(loaded, 'pathToRegexp');

/**
 * The `@nestjs/serve-static` peer, when the loaded module is
 * one.
 */
const isModulePeer = (loaded: unknown): loaded is PeerModule =>
  hasFunction(loaded, 'ServeStaticModule');

/** The module the loader swap is fitted onto, or nothing. */
const serveStaticModule = (
  peers: Peers,
): ServeStaticShape | undefined => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? undefined
    : serveStatic.ServeStaticModule;
};

/** The SPA fallback path, from the peer or from the fallback. */
const renderPath = (peers: Peers): string => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? DEFAULT_EXPRESS_RENDER_PATH
    : (serveStatic.DEFAULT_EXPRESS_RENDER_PATH ??
        DEFAULT_EXPRESS_RENDER_PATH);
};

/** The client directory, from the peer or from the fallback. */
const rootPath = (peers: Peers): string => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? DEFAULT_ROOT_PATH
    : (serveStatic.DEFAULT_ROOT_PATH ?? DEFAULT_ROOT_PATH);
};

/** The exception the fallback answers a miss with. */
const notFoundException = (
  peers: Peers,
): NotFoundShape | undefined => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? undefined
    : serveStatic.NotFoundException;
};

/**
 * Compiles one exclusion into a matcher; without the peer,
 * nothing.
 */
const matcherOf = (
  peers: Peers,
  entry: string,
): RegExp | undefined => {
  const { pathToRegexp } = peers;
  return pathToRegexp === undefined
    ? undefined
    : pathToRegexp.pathToRegexp(entry).regexp;
};

export {
  isMatcherPeer,
  isModulePeer,
  matcherOf,
  notFoundException,
  renderPath,
  rootPath,
  serveStaticModule,
};
