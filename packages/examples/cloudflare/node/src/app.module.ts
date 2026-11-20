import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { InertiaModule } from '@dudousxd/nestjs-inertia';

import { inertiaOptions } from '@ailura/examples-shared';

import { AppController } from './app.controller.ts';
import { BoomFilter } from './boom.filter.ts';
import { V2Controller } from './v2.controller.ts';

/** The demo module for the Worker's Node server. */
@Module({
  imports: [InertiaModule.forRoot(inertiaOptions())],
  controllers: [AppController, V2Controller],
  providers: [{ provide: APP_FILTER, useClass: BoomFilter }],
})
export class AppModule {}
