import { DEFAULT_EXPRESS_RENDER_PATH, DEFAULT_ROOT_PATH } from './peer-shapes.ts';
import type {
  NotFoundShape,
  PathToRegexpShape,
  PeerModule,
  Peers,
  ServeStaticShape,
} from './peer-shapes.ts';

const hasFunction = (loaded: unknown, name: string): boolean =>
  typeof loaded === 'object' && loaded !== null && typeof Reflect.get(loaded, name) === 'function';

const isMatcherPeer = (loaded: unknown): loaded is PathToRegexpShape =>
  hasFunction(loaded, 'pathToRegexp');

const isModulePeer = (loaded: unknown): loaded is PeerModule =>
  hasFunction(loaded, 'ServeStaticModule');

const serveStaticModule = (peers: Peers): ServeStaticShape | undefined => {
  const { serveStatic } = peers;
  return serveStatic === undefined ? undefined : serveStatic.ServeStaticModule;
};

const renderPath = (peers: Peers): string => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? DEFAULT_EXPRESS_RENDER_PATH
    : (serveStatic.DEFAULT_EXPRESS_RENDER_PATH ?? DEFAULT_EXPRESS_RENDER_PATH);
};

const rootPath = (peers: Peers): string => {
  const { serveStatic } = peers;
  return serveStatic === undefined
    ? DEFAULT_ROOT_PATH
    : (serveStatic.DEFAULT_ROOT_PATH ?? DEFAULT_ROOT_PATH);
};

const notFoundException = (peers: Peers): NotFoundShape | undefined => {
  const { serveStatic } = peers;
  return serveStatic === undefined ? undefined : serveStatic.NotFoundException;
};

const matcherOf = (peers: Peers, entry: string): RegExp | undefined => {
  const { pathToRegexp } = peers;
  return pathToRegexp === undefined ? undefined : pathToRegexp.pathToRegexp(entry).regexp;
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
