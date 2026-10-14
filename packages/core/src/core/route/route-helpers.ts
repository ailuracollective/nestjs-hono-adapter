import { RequestMethod } from '@nestjs/common';

import type { NestHandler } from '#adapter/core/request/request';

const METHOD_BY_REQUEST_METHOD: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.SEARCH]: 'SEARCH',
  [RequestMethod.PROPFIND]: 'PROPFIND',
  [RequestMethod.PROPPATCH]: 'PROPPATCH',
  [RequestMethod.MKCOL]: 'MKCOL',
  [RequestMethod.COPY]: 'COPY',
  [RequestMethod.MOVE]: 'MOVE',
  [RequestMethod.LOCK]: 'LOCK',
  [RequestMethod.UNLOCK]: 'UNLOCK',
  [RequestMethod.QUERY]: 'QUERY',
};

const ALL_METHOD = 'ALL';

const ROOT_PATH = '/';

const EVERY_PATH = '*';

type RouteTarget = string | NestHandler;

const isHandler = (value: unknown): value is NestHandler => typeof value === 'function';

const resolveRoute = (
  target: RouteTarget,
  handler: NestHandler | undefined,
): [string, NestHandler] => {
  if (typeof target === 'function') return [ROOT_PATH, target];
  if (handler === undefined)
    throw new TypeError('A route registered with a path also needs a handler.');
  return [target, handler];
};

const toMiddlewarePath = (path: string): string => {
  if (path === ROOT_PATH) return EVERY_PATH;
  if (path.endsWith(EVERY_PATH)) {
    return path;
  }
  const trimmed = path.replace(/\/+$/u, '');
  return `${trimmed}/${EVERY_PATH}`;
};

export {
  ALL_METHOD,
  EVERY_PATH,
  METHOD_BY_REQUEST_METHOD,
  isHandler,
  resolveRoute,
  toMiddlewarePath,
};
export type { RouteTarget };
