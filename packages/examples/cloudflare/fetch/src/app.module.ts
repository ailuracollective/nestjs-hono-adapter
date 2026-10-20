import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AppController } from './app.controller.ts';
import { BoomFilter } from './boom.filter.ts';
import { Gateway } from './gateway.ts';
import { V2Controller } from './v2.controller.ts';

/** The example module. */
@Module({
  controllers: [AppController, V2Controller],
  providers: [Gateway, { provide: APP_FILTER, useClass: BoomFilter }],
})
export class AppModule {}
