import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AppController } from './app.controller.ts';
import { BoomFilter } from './boom.filter.ts';
import { V2Controller } from './v2.controller.ts';

@Module({
  controllers: [AppController, V2Controller],
  providers: [{ provide: APP_FILTER, useClass: BoomFilter }],
})
export class AppModule {}
