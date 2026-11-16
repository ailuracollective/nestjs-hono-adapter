import { Module } from '@nestjs/common';

import { BenchController } from './bench.controller.ts';

/** Root Nest module for the base scenarios: no Inertia providers at all. */
@Module({
  controllers: [BenchController],
})
export class BaseModule {}
