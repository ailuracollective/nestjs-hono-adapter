/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TerminusModule,
} from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

/** The key an indicator answers under. */
const HEALTHY = 'fixture';

/** The status an indicator reports when its target is up. */
const UP = 'up';

/** The status an indicator reports when its target is down. */
const DOWN = 'down';

/** The cache directive `@HealthCheck` sets on the answer. */
const NO_CACHE = 'no-cache, no-store, must-revalidate';

/** The aggregate status of a healthy check. */
const OK = 'ok';

/** The aggregate status of a check with a failing indicator. */
const ERROR = 'error';

/** The aggregate status of an impaired but serving check. */
const DEGRADED = 'degraded';

/** The controller answering the health checks. */
@Controller('health')
class HealthController {
  /** The service running the checks. */
  private readonly checks: HealthCheckService;
  /** The service building the indicators. */
  private readonly indicators: HealthIndicatorService;

  public constructor(
    checks: HealthCheckService,
    indicators: HealthIndicatorService,
  ) {
    this.checks = checks;
    this.indicators = indicators;
  }

  /** A check whose indicator reports health. */
  @Get()
  @HealthCheck()
  public healthy(): Promise<HealthCheckResult> {
    return this.checks.check([
      () => this.indicators.check(HEALTHY).up(),
    ]);
  }

  /** A check whose indicator reports a failure. */
  @Get('failing')
  @HealthCheck()
  public failingCheck(): Promise<HealthCheckResult> {
    return this.checks.check([
      () =>
        this.indicators
          .check(HEALTHY)
          .down({ reason: 'unreachable' }),
    ]);
  }

  /** A check that is impaired but still serving. */
  @Get('degraded')
  @HealthCheck()
  public degradedCheck(): Promise<HealthCheckResult> {
    return this.checks.check([
      () => this.indicators.check(HEALTHY).degraded('impaired'),
    ]);
  }
}

/** The module declaring the health controller. */
@Module({
  controllers: [HealthController],
  imports: [TerminusModule],
})
class HealthModule {}

export {
  DEGRADED,
  DOWN,
  ERROR,
  HEALTHY,
  HealthModule,
  NO_CACHE,
  OK,
  UP,
};
