import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

const EVERY = 20;

@Injectable()
class CountingJob {
  public runs = 0;

  public readonly firstRun: Promise<void>;

  public constructor() {
    // oxlint-disable-next-line promise/avoid-new -- the promise settles from the timer, outside this body; written with `async` it would resolve at the first `await` and settle nothing afterwards.
    this.firstRun = new Promise<void>((resolve) => {
      this.markFirst = resolve;
    });
  }

  private markFirst: () => void = () => {
    // The constructor replaces it before it can be called.
  };

  @Interval(EVERY)
  public tick(): void {
    this.runs += 1;
    this.markFirst();
  }
}

@Injectable()
class BootstrapJob implements OnApplicationBootstrap {
  public bootstrapped = false;

  public onApplicationBootstrap(): void {
    this.bootstrapped = true;
  }
}

export { BootstrapJob, CountingJob, EVERY };
