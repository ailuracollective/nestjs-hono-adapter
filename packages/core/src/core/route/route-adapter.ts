import type {
  RequestMethod,
  VersioningOptions,
} from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';

import type { Server } from '#adapter/core/ports/server';
import type {
  NestContext,
  NestHono,
} from '#adapter/core/context';
import type {
  NestHandler,
  NestRequest,
} from '#adapter/core/request/request';
import { createVersionFilter } from './version-filter.ts';
import type { VersionValue } from './version-filter.ts';
import { asVersionedRoute } from './versioned-route.ts';
import type { VersionedRoute } from './versioned-route.ts';
import { createInject } from '#adapter/core/inject/helpers';
import type { InjectRunner } from '#adapter/core/inject/types';
import {
  ALL_METHOD,
  EVERY_PATH,
  METHOD_BY_REQUEST_METHOD,
  isHandler,
  resolveRoute,
  toMiddlewarePath,
} from './route-helpers.ts';
import type { RouteTarget } from './route-helpers.ts';

/** The routing half of the Nest adapter contract. */
abstract class RouteAdapter extends AbstractHttpAdapter<
  Server,
  NestRequest,
  NestContext
> {
  /** Answers an in-process request without binding a port. */
  public inject: InjectRunner = (options) =>
    createInject(this.getInstance<NestHono>())(options);

  /** Registers one route with the underlying framework. */
  protected abstract register(
    method: string,
    path: string,
    handler: NestHandler,
  ): void;

  /** Mounts middleware over a path and everything under it. */
  protected abstract mount(
    path: string,
    handler: NestHandler,
  ): void;

  /** Registers a GET route. */
  public override get(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('GET', target, handler);
  }

  /** Registers a POST route. */
  public override post(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('POST', target, handler);
  }

  /** Registers a PUT route. */
  public override put(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PUT', target, handler);
  }

  /** Registers a PATCH route. */
  public override patch(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PATCH', target, handler);
  }

  /** Registers a DELETE route. */
  public override delete(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('DELETE', target, handler);
  }

  /** Registers an OPTIONS route. */
  public override options(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('OPTIONS', target, handler);
  }

  /** Registers a HEAD route. */
  public override head(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('HEAD', target, handler);
  }

  /** Registers one route for every verb. */
  public override all(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route(ALL_METHOD, target, handler);
  }

  /** Registers a SEARCH route. */
  public override search(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('SEARCH', target, handler);
  }

  /** Registers a QUERY route. */
  public override query(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('QUERY', target, handler);
  }

  /** Registers a PROPFIND route. */
  public override propfind(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PROPFIND', target, handler);
  }

  /** Registers a PROPPATCH route. */
  public override proppatch(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('PROPPATCH', target, handler);
  }

  /** Registers a MKCOL route. */
  public override mkcol(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('MKCOL', target, handler);
  }

  /** Registers a COPY route. */
  public override copy(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('COPY', target, handler);
  }

  /** Registers a MOVE route. */
  public override move(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('MOVE', target, handler);
  }

  /** Registers a LOCK route. */
  public override lock(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('LOCK', target, handler);
  }

  /** Registers an UNLOCK route. */
  public override unlock(
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    this.route('UNLOCK', target, handler);
  }

  /** Mounts global middleware. */
  public override use(...args: unknown[]): void {
    const [first, second] = args;
    if (isHandler(first) && second === undefined) {
      this.mount(EVERY_PATH, first);
      return;
    }
    if (typeof first === 'string' && isHandler(second)) {
      this.mount(toMiddlewarePath(first), second);
      return;
    }
    throw new TypeError(
      'Middleware is mounted as a handler, or as a path and a ' +
        'handler.',
    );
  }

  /** Mounts one piece of Nest middleware. */
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
      if (method === ALL_METHOD) {
        this.mount(toMiddlewarePath(path), callback);
        return;
      }
      this.route(method, path, callback);
    };
  }

  /** Guards a route with its version filter. */
  public override applyVersionFilter(
    handler: NestHandler,
    version: VersionValue,
    versioningOptions: VersioningOptions,
  ): VersionedRoute {
    return asVersionedRoute(
      createVersionFilter(handler, version, versioningOptions),
    );
  }

  /** Registers one route and its handler. */
  private route(
    method: string,
    target: RouteTarget,
    handler?: NestHandler,
  ): void {
    const [path, routeHandler] = resolveRoute(target, handler);
    this.register(method, path, routeHandler);
  }
}

export { RouteAdapter };
export { ALL_METHOD } from './route-helpers.ts';
