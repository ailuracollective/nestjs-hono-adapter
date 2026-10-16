import 'reflect-metadata';

import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

import { ApiController, MarkerMiddleware, RootController } from './controllers.ts';

@Module({ controllers: [RootController, ApiController] })
class GlobalMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('*');
  }
}

@Module({ controllers: [RootController, ApiController] })
class PrefixedMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes('api');
  }
}

@Module({ controllers: [ApiController] })
class MethodMiddlewareModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MarkerMiddleware).forRoutes({
      method: RequestMethod.POST,
      path: 'api/ping',
    });
  }
}

export { GlobalMiddlewareModule, MethodMiddlewareModule, PrefixedMiddlewareModule };
