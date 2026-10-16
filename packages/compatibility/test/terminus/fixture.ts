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

const HEALTHY = 'fixture';

const UP = 'up';

const DOWN = 'down';

const NO_CACHE = 'no-cache, no-store, must-revalidate';

const OK = 'ok';

const ERROR = 'error';

const DEGRADED = 'degraded';

@Controller('health')
class HealthController {
  private readonly checks: HealthCheckService;
  private readonly indicators: HealthIndicatorService;

  public constructor(checks: HealthCheckService, indicators: HealthIndicatorService) {
    this.checks = checks;
    this.indicators = indicators;
  }

  @Get()
  @HealthCheck()
  public healthy(): Promise<HealthCheckResult> {
    return this.checks.check([() => this.indicators.check(HEALTHY).up()]);
  }

  @Get('failing')
  @HealthCheck()
  public failingCheck(): Promise<HealthCheckResult> {
    return this.checks.check([
      () => this.indicators.check(HEALTHY).down({ reason: 'unreachable' }),
    ]);
  }

  @Get('degraded')
  @HealthCheck()
  public degradedCheck(): Promise<HealthCheckResult> {
    return this.checks.check([() => this.indicators.check(HEALTHY).degraded('impaired')]);
  }
}

@Module({
  controllers: [HealthController],
  imports: [TerminusModule],
})
class HealthModule {}

export { DEGRADED, DOWN, ERROR, HEALTHY, HealthModule, NO_CACHE, OK, UP };
