import { Controller, Get, Module } from '@nestjs/common';
import type { NestApplicationOptions } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { createObserveModule } from '@nestjs/observe';
import { OutboxModule } from '@nestjs/outbox';
import type { Queue } from 'bull';

import type { CompatibilityCase } from './types.ts';

const REDIS_PORT = 6399;

@Controller()
class BullController {
  private readonly queue: Queue;

  public constructor(@InjectQueue('probe') queue: Queue) {
    this.queue = queue;
  }

  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: this.queue.name === 'probe' };
  }
}

@Module({
  controllers: [BullController],
  imports: [
    // `lazyConnect` keeps the queue from dialling Redis until a job is added, so the module
    // boots and the adapter serves the route with no broker running.
    BullModule.forRoot({
      redis: { host: '127.0.0.1', lazyConnect: true, port: REDIS_PORT },
    }),
    BullModule.registerQueue({ name: 'probe' }),
  ],
})
class BullFixture {}

const { ObserveInstrument, ObserveModule } = createObserveModule();

const observeApplication: NestApplicationOptions = {};
if (ObserveInstrument !== undefined) observeApplication.instrument = ObserveInstrument;

@Controller()
class ObserveController {
  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  controllers: [ObserveController],
  imports: [
    ObserveModule.forRoot({ appKey: 'probe-key', appSecret: 'probe-secret', serviceId: 'probe' }),
  ],
})
class ObserveFixture {}

@Controller()
class OutboxController {
  @Get('ping')
  public ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  controllers: [OutboxController],
  imports: [OutboxModule.forRoot({ allowInMemoryStorage: true })],
})
class OutboxFixture {}

const MESSAGING_CASES: readonly CompatibilityCase[] = [
  { module: BullFixture, name: '@nestjs/bull' },
  {
    module: ObserveFixture,
    name: '@nestjs/observe',
    options: { application: observeApplication },
  },
  { module: OutboxFixture, name: '@nestjs/outbox' },
];

export { MESSAGING_CASES };
