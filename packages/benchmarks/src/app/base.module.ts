import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

import { BenchController } from './bench.controller.ts';

/** Root Nest module for the base scenarios: no Inertia providers at all. */
@Module({
  controllers: [BenchController],
})
export class BaseModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((_request: unknown, _response: unknown, next: () => void): void => {
        next();
      })
      .forRoutes('middleware');
  }
}
