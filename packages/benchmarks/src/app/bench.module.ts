import { Module } from '@nestjs/common';
import { BenchController } from './bench.controller.ts';

/** Root Nest module for the benchmark application. */
@Module({
  controllers: [BenchController],
})
export class BenchModule {}
