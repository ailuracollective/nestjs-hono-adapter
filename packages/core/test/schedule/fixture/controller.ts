/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import {
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';

import { BootstrapJob, CountingJob } from './jobs.ts';

/** The controller reading the job state back. */
@Controller('jobs')
class JobController {
  /** The job the bootstrap route reads. */
  private readonly bootstrapped: BootstrapJob;
  /** The job the count route reads. */
  private readonly counting: CountingJob;
  /** The registry the intervals route reads. */
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

  /** Answers with how many times the interval has fired. */
  @Get('runs')
  public runs(): { readonly runs: number } {
    return { runs: this.counting.runs };
  }

  /** Answers with whether the bootstrap hook ran. */
  @Get('bootstrapped')
  public hasBootstrapped(): { readonly bootstrapped: boolean } {
    return { bootstrapped: this.bootstrapped.bootstrapped };
  }

  /** Answers with the intervals the package is holding. */
  @Get('intervals')
  public intervals(): { readonly count: number } {
    return { count: this.registry.getIntervals().length };
  }
}

/** The module declaring the job controller and jobs. */
@Module({
  controllers: [JobController],
  imports: [ScheduleModule.forRoot()],
  providers: [CountingJob, BootstrapJob],
})
class JobModule {}

export { JobModule };
