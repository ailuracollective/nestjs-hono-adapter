import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

const EVERY = 20;

/** A job that counts its own runs. */
@Injectable()
class CountingJob {
  /** How many times the job has run. */
  public runs = 0;

  /** Settles the first time the job runs. */
  public readonly firstRun: Promise<void>;

  /** Builds the signal the first run settles. */
  public constructor() {
    // oxlint-disable-next-line promise/avoid-new -- the promise settles from the timer, outside this body; written with `async` it would resolve at the first `await` and settle nothing afterwards.
    this.firstRun = new Promise<void>((resolve) => {
      this.markFirst = resolve;
    });
  }

  /** Settles the first-run signal. */
  private markFirst: () => void = () => {
    // The constructor replaces it before it can be called.
  };

  /** Counts one run and signals the first. */
  @Interval(EVERY)
  public tick(): void {
    this.runs += 1;
    this.markFirst();
  }
}

/** A job under the hook the package calls on start. */
@Injectable()
class BootstrapJob implements OnApplicationBootstrap {
  /** Whether the hook ran. */
  public bootstrapped = false;

  /** Records that the hook ran. */
  public onApplicationBootstrap(): void {
    this.bootstrapped = true;
  }
}

export { BootstrapJob, CountingJob, EVERY };
