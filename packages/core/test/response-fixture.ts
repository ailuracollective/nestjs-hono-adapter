import 'reflect-metadata';

import { Module } from '@nestjs/common';

import { ContentController } from './response-fixture/content.ts';
import { ImperativeController } from './response-fixture/imperative.ts';
import { StatusController } from './response-fixture/status.ts';

/** The module declaring the response controllers. */
@Module({
  controllers: [
    ImperativeController,
    StatusController,
    ContentController,
  ],
})
class ResponseModule {}

export { ResponseModule };
