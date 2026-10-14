/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';

import { BootstrapJob, CountingJob } from './jobs.ts';

@Controller('jobs')
class JobController {
  private readonly bootstrapped: BootstrapJob;
  private readonly counting: CountingJob;
  private readonly registry: SchedulerRegistry;

  public constructor(
    bootstrapped: BootstrapJob,
    counting: CountingJob,
    registry: SchedulerRegistry,
  ) {
    this.bootstrapped = bootstrapped;
    this.counting = counting;
    this.registry = registry;
  }

  @Get('runs')
  public runs(): { readonly runs: number } {
    return { runs: this.counting.runs };
  }

  @Get('bootstrapped')
  public hasBootstrapped(): { readonly bootstrapped: boolean } {
    return { bootstrapped: this.bootstrapped.bootstrapped };
  }

  @Get('intervals')
  public intervals(): { readonly count: number } {
    return { count: this.registry.getIntervals().length };
  }
}

@Module({
  controllers: [JobController],
  imports: [ScheduleModule.forRoot()],
  providers: [CountingJob, BootstrapJob],
})
class JobModule {}

export { JobModule };
