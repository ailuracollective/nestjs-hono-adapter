import type { RequestMethod, VersioningOptions } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';

import type { Server } from '#adapter/core/ports/server';
import type { NestContext, NestHono } from '#adapter/core/context';
import type { NestHandler, NestRequest } from '#adapter/core/request/request';
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

abstract class RouteAdapter extends AbstractHttpAdapter<Server, NestRequest, NestContext> {
  public inject: InjectRunner = (options) => createInject(this.getInstance<NestHono>())(options);

  protected abstract register(method: string, path: string, handler: NestHandler): void;

  protected abstract mount(path: string, handler: NestHandler): void;

  public override get(target: RouteTarget, handler?: NestHandler): void {
    this.route('GET', target, handler);
  }

  public override post(target: RouteTarget, handler?: NestHandler): void {
    this.route('POST', target, handler);
  }

  public override put(target: RouteTarget, handler?: NestHandler): void {
    this.route('PUT', target, handler);
  }

  public override patch(target: RouteTarget, handler?: NestHandler): void {
    this.route('PATCH', target, handler);
  }

  public override delete(target: RouteTarget, handler?: NestHandler): void {
    this.route('DELETE', target, handler);
  }

  public override options(target: RouteTarget, handler?: NestHandler): void {
    this.route('OPTIONS', target, handler);
  }

  public override head(target: RouteTarget, handler?: NestHandler): void {
    this.route('HEAD', target, handler);
  }

  public override all(target: RouteTarget, handler?: NestHandler): void {
    this.route(ALL_METHOD, target, handler);
  }

  public override search(target: RouteTarget, handler?: NestHandler): void {
    this.route('SEARCH', target, handler);
  }

  public override query(target: RouteTarget, handler?: NestHandler): void {
    this.route('QUERY', target, handler);
  }

  public override propfind(target: RouteTarget, handler?: NestHandler): void {
    this.route('PROPFIND', target, handler);
  }

  public override proppatch(target: RouteTarget, handler?: NestHandler): void {
    this.route('PROPPATCH', target, handler);
  }

  public override mkcol(target: RouteTarget, handler?: NestHandler): void {
    this.route('MKCOL', target, handler);
  }

  public override copy(target: RouteTarget, handler?: NestHandler): void {
    this.route('COPY', target, handler);
  }

  public override move(target: RouteTarget, handler?: NestHandler): void {
    this.route('MOVE', target, handler);
  }

  public override lock(target: RouteTarget, handler?: NestHandler): void {
    this.route('LOCK', target, handler);
  }

  public override unlock(target: RouteTarget, handler?: NestHandler): void {
    this.route('UNLOCK', target, handler);
  }

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
    throw new TypeError('Middleware is mounted as a handler, or as a path and a handler.');
  }

  public override createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): (path: string, callback: unknown) => void {
    const method = METHOD_BY_REQUEST_METHOD[requestMethod] ?? ALL_METHOD;
    return (path, callback) => {
      if (!isHandler(callback)) {
        throw new TypeError('Nest middleware must be registered as a function.');
      }
      if (method === ALL_METHOD) {
        this.mount(toMiddlewarePath(path), callback);
        return;
      }
      this.route(method, path, callback);
    };
  }

  public override applyVersionFilter(
    handler: NestHandler,
    version: VersionValue,
    versioningOptions: VersioningOptions,
  ): VersionedRoute {
    return asVersionedRoute(createVersionFilter(handler, version, versioningOptions));
  }

  private route(method: string, target: RouteTarget, handler?: NestHandler): void {
    const [path, routeHandler] = resolveRoute(target, handler);
    this.register(method, path, routeHandler);
  }
}

export { RouteAdapter };
export { ALL_METHOD } from './route-helpers.ts';
