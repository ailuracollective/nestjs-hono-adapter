import type { ServerType } from '@hono/node-server';
import { RequestMethod } from '@nestjs/common';
import type { VersioningOptions } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';

import type { NestHandler, NestRequest } from './bridge.ts';
import type { NestContext } from './context.ts';
import { createVersionFilter } from './version-filter.ts';
import type { VersionValue } from './version-filter.ts';
import { asVersionedRoute } from './versioned-route.ts';
import type { VersionedRoute } from './versioned-route.ts';

/**
 * Nest's verb enum mapped onto HTTP method names, for the one
 * place that receives the enum rather than the name.
 */
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

/**
 * Method registered for a route that answers every verb, and
 * for middleware, which Nest mounts without one.
 */
const ALL_METHOD = 'ALL';

/** Path a handler is mounted at when Nest passes it without one. */
const ROOT_PATH = '/';

/** Either a route path, or the handler to mount at the root. */
type RouteTarget = string | NestHandler;

function isHandler(value: unknown): value is NestHandler {
  return typeof value === 'function';
}

function resolveRoute(
  target: RouteTarget,
  handler: NestHandler | undefined,
): [string, NestHandler] {
  if (typeof target === 'function') {
    return [ROOT_PATH, target];
  }
  if (handler === undefined) {
    throw new TypeError(
      'A route registered with a path also needs a handler.',
    );
  }
  return [target, handler];
}

/**
 * The routing half of the Nest adapter contract: every verb a
 * route can be mapped to, the middleware factory and version
 * filtering. The concrete adapter supplies the registration, so
 * this half never touches Hono itself.
 */
abstract class RouteAdapter extends AbstractHttpAdapter<
  ServerType,
  NestRequest,
  NestContext
> {
  /** Registers one route with the underlying framework. */
  protected abstract register(
    method: string,
    path: string,
    handler: NestHandler,
  ): void;

  public override get(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('GET', target, handler);
  }

  public override post(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('POST', target, handler);
  }

  public override put(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PUT', target, handler);
  }

  public override patch(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PATCH', target, handler);
  }

  public override delete(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('DELETE', target, handler);
  }

  public override options(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('OPTIONS', target, handler);
  }

  public override head(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('HEAD', target, handler);
  }

  public override all(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route(ALL_METHOD, target, handler);
  }

  public override search(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('SEARCH', target, handler);
  }

  public override query(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('QUERY', target, handler);
  }

  public override propfind(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PROPFIND', target, handler);
  }

  public override proppatch(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PROPPATCH', target, handler);
  }

  public override mkcol(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('MKCOL', target, handler);
  }

  public override copy(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('COPY', target, handler);
  }

  public override move(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('MOVE', target, handler);
  }

  public override lock(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('LOCK', target, handler);
  }

  public override unlock(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('UNLOCK', target, handler);
  }

  /**
   * Mounts global middleware. Nest calls this with a handler,
   * or with a path and a handler, and both answer every
   * method.
   */
  public override use(...args: unknown[]): void {
    const [first, second] = args;
    if (isHandler(first) && second === undefined) {
      this.route(ALL_METHOD, first);
      return;
    }
    if (typeof first === 'string' && isHandler(second)) {
      this.route(ALL_METHOD, first, second);
      return;
    }
    throw new TypeError(
      'Middleware is mounted as a handler, or as a path and a ' +
        'handler.',
    );
  }

  public override createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): (path: string, callback: unknown) => void {
    const method =
      METHOD_BY_REQUEST_METHOD[requestMethod] ?? ALL_METHOD;
    return (path, callback) => {
      if (!isHandler(callback)) {
        throw new TypeError(
          'Nest middleware must be registered as a function.',
        );
      }
      this.route(method, path, callback);
    };
  }

  public override applyVersionFilter(
    handler: NestHandler,
    version: VersionValue,
    versioningOptions: VersioningOptions,
  ): VersionedRoute {
    return asVersionedRoute(
      createVersionFilter(handler, version, versioningOptions),
    );
  }

  private route(
    method: string,
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    const [path, routeHandler] = resolveRoute(target, handler);
    this.register(method, path, routeHandler);
  }
}

export { ALL_METHOD, RouteAdapter };
