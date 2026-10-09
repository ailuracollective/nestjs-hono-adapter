/**
 * The cases that show `@nestjs/terminus` works on this adapter.
 *
 * The package answers a health check with a status it chooses
 * rather than one the route names, and it writes that status
 * through the framework's own machinery: a failing indicator is
 * not a route that returns an error, it is a result the service
 * turns into a status on the way out. That makes the cases
 * below the sharpest ones in this suite for the adapter — a
 * body the package wrote and a status it chose both have to
 * arrive as they were decided.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';

import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TerminusModule,
} from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** The key an indicator answers under. */
const HEALTHY = 'fixture';

/**
 * The status an indicator reports when the thing it watches is
 * there.
 */
const UP = 'up';

/**
 * The status an indicator reports when the thing it watches is
 * not.
 */
const DOWN = 'down';

/**
 * What `@HealthCheck` sets on the answer. The official suite
 * asserts this exact string, so a case here asserts it exactly
 * too: a cache directive that changed shape would be a
 * difference between this adapter and the two the package is
 * tested against.
 */
const NO_CACHE = 'no-cache, no-store, must-revalidate';

/**
 * The aggregate status of a check whose indicators are all
 * healthy.
 */
const OK = 'ok';

/** The aggregate status of a check with a failing indicator. */
const ERROR = 'error';

/**
 * The aggregate status of a check that is impaired but still
 * serving.
 */
const DEGRADED = 'degraded';

@Controller('health')
class HealthController {
  private readonly checks: HealthCheckService;
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

  /**
   * A check whose indicator reports a failure, which is the
   * shape a real indicator takes when the thing it watches is
   * not there.
   */
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

  /**
   * A check that is impaired rather than broken: the package
   * keeps this one at 200 while still naming the impairment,
   * which is a status a case would otherwise not expect to see
   * pass through.
   */
  @Get('degraded')
  @HealthCheck()
  public degradedCheck(): Promise<HealthCheckResult> {
    return this.checks.check([
      () => this.indicators.check(HEALTHY).degraded('impaired'),
    ]);
  }
}

@Module({
  controllers: [HealthController],
  imports: [TerminusModule],
})
class HealthModule {}

/** The body a healthy check answers with. */
const HEALTHY_BODY = {
  details: { [HEALTHY]: { status: UP } },
  error: {},
  info: { [HEALTHY]: { status: UP } },
  status: OK,
};

/** The body a check with a failing indicator answers with. */
const FAILED_BODY = {
  details: {
    [HEALTHY]: { reason: 'unreachable', status: DOWN },
  },
  error: { [HEALTHY]: { reason: 'unreachable', status: DOWN } },
  info: {},
  status: ERROR,
};

async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  const probe = await startProbe({
    mode: 'in-process',
    module: HealthModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('a check whose indicators are healthy is answered as healthy', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(HEALTHY_BODY);
  });
});

test('a check whose indicator failed is answered as down', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/failing');

    expect(response.status).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(response.body).toStrictEqual(FAILED_BODY);
  });
});

test('an impaired check stays at 200 while naming the impairment', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/degraded');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toMatchObject({ status: DEGRADED });
  });
});

test('the two checks are told apart by the status alone', async () => {
  await withProbe(async (probe) => {
    const healthy = await request(probe, '/health');
    const failing = await request(probe, '/health/failing');

    expect(healthy.status).toBe(HttpStatus.OK);
    expect(failing.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

test('a check carries the key its indicator answered under', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    expect(response.body).toMatchObject({
      info: { [HEALTHY]: { status: UP } },
    });
  });
});

test('the check is answered with the cache the decorator sets', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health');

    // The official suite asserts this by value on the real
    // response: `@HealthCheck` sets it from an interceptor, so it
    // only arrives if the adapter carries a header written after it
    // took the response over.
    expect(response.headers.get('cache-control')).toBe(
      NO_CACHE,
    );
  });
});

test('a degraded check is answered with the same cache header', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/health/degraded');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.headers.get('cache-control')).toBe(
      NO_CACHE,
    );
  });
});

test('a health check answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: HealthModule,
  });
  try {
    const response = await request(probe, '/health');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(HEALTHY_BODY);
  } finally {
    await probe.close();
  }
});
