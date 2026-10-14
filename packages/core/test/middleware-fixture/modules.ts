import 'reflect-metadata';

import { Module, RequestMethod } from '@nestjs/common';
import type {
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';

import {
  ApiController,
  MarkerMiddleware,
  RootController,
} from './controllers.ts';

/** A module whose middleware answers every path. */
@Module({ controllers: [RootController, ApiController] })
class GlobalMiddlewareModule implements NestModule {
  /** Mounts the marker middleware on every path. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('*');
  }
}

/** A module whose middleware answers the prefix. */
@Module({ controllers: [RootController, ApiController] })
class PrefixedMiddlewareModule implements NestModule {
  /** Mounts the marker middleware on the prefix. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('api');
  }
}

/** A module whose middleware answers one method of one path. */
@Module({ controllers: [ApiController] })
class MethodMiddlewareModule implements NestModule {
  /** Mounts the marker middleware on one method. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes({
      method: RequestMethod.POST,
      path: 'api/ping',
    });
  }
}

export {
  GlobalMiddlewareModule,
  MethodMiddlewareModule,
  PrefixedMiddlewareModule,
};
