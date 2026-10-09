/**
 * The cases that show `@nestjs/schedule` works on this adapter.
 *
 * The package is the one here that reaches the adapter least:
 * it owns timers rather than routes, and a scheduled method is
 * not something a request reaches. That is exactly why it is
 * worth a case — what it proves is the other direction of the
 * claim. A job runs with the application up, without a request
 * ever arriving, and a request that arrives afterwards reads
 * back what the job did. An adapter that kept the application
 * from settling, or that closed the application while a timer
 * was live, would fail here and pass every other case in this
 * suite.
 *
 * The cases wait on the job's own signal rather than by polling
 * the route that reads its count. Polling worked, but it made
 * the suite depend on the loop being slow enough for a request
 * to reach a timed method: the job's first run is a fact the
 * job knows, and waiting on it is what makes these cases
 * deterministic.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
} from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';

import {
  Interval,
  SchedulerRegistry,
  ScheduleModule,
} from '@nestjs/schedule';

import { setTimeout } from 'node:timers/promises';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** How often the job runs, in milliseconds. */
const EVERY = 20;

/**
 * The status a route that answered is at, as a number: Nest
 * names it through an enum and a plain number is what a
 * response carries, so the case compares two numbers rather
 * than an enum to a number.
 */
const HTTP_OK = 200;

/**
 * How many windows a case lets pass before it concludes the job
 * stopped.
 */
const WINDOWS = 3;

/**
 * The job, which counts its own runs and says when the first of
 * them happened. A case waits on that signal rather than on a
 * request: the count is what a route reads, but the signal is
 * what the timer owes the application.
 */
@Injectable()
class CountingJob {
  /** How many times the job has run. */
  public runs = 0;

  /** Settles the first time the job runs. */
  public readonly firstRun: Promise<void>;

  public constructor() {
    // oxlint-disable-next-line promise/avoid-new -- the promise settles from the timer, outside this body; written with `async` it would resolve at the first `await` and settle nothing afterwards.
    this.firstRun = new Promise<void>((resolve) => {
      this.markFirst = resolve;
    });
  }

  private markFirst: () => void = () => {
    // Replaced by the executor below, before the constructor returns.
  };

  @Interval(EVERY)
  public tick(): void {
    this.runs += 1;
    this.markFirst();
  }
}

/**
 * The same job under the hook the package calls once the
 * application is up, which is a different registration path
 * from the interval: the hook is resolved by the container
 * rather than by a timer.
 */
@Injectable()
class BootstrapJob implements OnApplicationBootstrap {
  /** Whether the hook ran. */
  public bootstrapped = false;

  public onApplicationBootstrap(): void {
    this.bootstrapped = true;
  }
}

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

@Module({
  controllers: [JobController],
  imports: [ScheduleModule.forRoot()],
  providers: [CountingJob, BootstrapJob],
})
class JobModule {}

/**
 * Waits the length of a few windows, so the job gets to run
 * again.
 */
async function windows(): Promise<void> {
  await setTimeout(EVERY * WINDOWS);
}

/** How many times the job has run, as the route reports it. */
async function runsReportedBy(probe: Probe): Promise<number> {
  const answered = await request(probe, '/jobs/runs');
  if (answered.status !== HTTP_OK) {
    throw new Error(
      `the count route answered ${answered.status}`,
    );
  }
  const { body } = answered;
  if (typeof body !== 'object' || body === null) {
    return 0;
  }
  const { runs } = body as { readonly runs?: unknown };
  if (typeof runs !== 'number') {
    return 0;
  }
  return runs;
}

test('a scheduled job runs with the application up', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const runs = await runsReportedBy(probe);

    expect(runs).toBeGreaterThanOrEqual(1);
  } finally {
    await probe.close();
  }
});

test('a scheduled job keeps running while requests are served', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const before = await runsReportedBy(probe);

    const served = await request(probe, '/jobs/intervals');
    expect(served.status).toBe(HttpStatus.OK);

    await windows();
    const after = await runsReportedBy(probe);

    expect(after).toBeGreaterThan(before);
  } finally {
    await probe.close();
  }
});

test('the bootstrap hook ran before any request arrived', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    const response = await request(probe, '/jobs/bootstrapped');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ bootstrapped: true });
  } finally {
    await probe.close();
  }
});

test('the package is holding the interval the job declared', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  try {
    const response = await request(probe, '/jobs/intervals');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ count: 1 });
  } finally {
    await probe.close();
  }
});

test('closing the application stops the job', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: JobModule,
  });
  const counting = probe.app.get(CountingJob);
  await counting.firstRun;
  await probe.close();

  // Nothing answers a request once the application is down, so what
  // is being shown is the job's own count: a timer the close did not
  // clear would keep moving it.
  const afterClose = counting.runs;
  await windows();

  expect(counting.runs).toBe(afterClose);
});

test('a scheduled application answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: JobModule,
  });
  try {
    await probe.app.get(CountingJob).firstRun;
    const response = await request(probe, '/jobs/bootstrapped');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(
      JSON.stringify({ bootstrapped: true }),
    );
  } finally {
    await probe.close();
  }
});
