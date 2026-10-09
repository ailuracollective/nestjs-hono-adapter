/**
 * The cases that show `@nestjs/event-emitter` works on this
 * adapter.
 *
 * The package is the plain counterpart of the event bus in
 * `@nestjs/cqrs`: a listener is named by a decorator, an
 * emitter publishes under that name, and the two meet without
 * either knowing the other. What the adapter adds to the
 * exchange is the round trip in between — a route emits, a
 * listener records, and the next request reads back what the
 * listener recorded, which is the only way to show the listener
 * ran on the application that answered.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';

import {
  EventEmitter2,
  EventEmitterModule,
  OnEvent,
} from '@nestjs/event-emitter';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** The event name a case emits and a listener answers. */
const EVENT = 'adapter.order.placed';

/** What a listener records, and a route reads back. */
const received: string[] = [];

@Controller()
class OrderController {
  private readonly emitter: EventEmitter2;

  public constructor(emitter: EventEmitter2) {
    this.emitter = emitter;
  }

  /** Emits the event and answers with what it emitted. */
  @Post('order')
  public place(): { readonly emitted: string } {
    this.emitter.emit(EVENT, 'placed');
    return { emitted: EVENT };
  }

  /**
   * Answers with what the listeners recorded, which is how a
   * case tells a listener that ran from one that did not: the
   * emission is already answered when the listener's answer is
   * the one in doubt.
   */
  @Get('orders')
  public orders(): { readonly handled: readonly string[] } {
    return { handled: [...received] };
  }
}

/**
 * A listener named by the decorator rather than registered by
 * hand, which is the shape the package documents: a provider
 * whose method carries `@OnEvent` is what the emitter's
 * discovery finds.
 */
@Injectable()
class OrderListener {
  @OnEvent(EVENT)
  public handle(payload: string): void {
    received.push(payload);
  }
}

@Module({
  controllers: [OrderController],
  imports: [EventEmitterModule.forRoot()],
  providers: [OrderListener],
})
class OrderModule {}

const ORDER_REQUEST = { method: 'POST' };

/** Starts the fixture with an empty record of what was handled. */
async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  received.length = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: OrderModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('a route answers after emitting an event', async () => {
  await withProbe(async (probe) => {
    const response = await request(
      probe,
      '/order',
      ORDER_REQUEST,
    );

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ emitted: EVENT });
  });
});

test('the event a route emitted reached a listener', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({
      handled: ['placed'],
    });
  });
});

test('an event with no listener named still leaves the route answered', async () => {
  await withProbe(async (probe) => {
    const response = await request(
      probe,
      '/order',
      ORDER_REQUEST,
    );

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.text).toBe(
      JSON.stringify({ emitted: EVENT }),
    );
  });
});

test('a listener sees every emission, in order', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/order', ORDER_REQUEST);
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.body).toStrictEqual({
      handled: ['placed', 'placed'],
    });
  });
});

test('the emitter and its listeners answer over a real connection', async () => {
  received.length = 0;
  const probe = await startProbe({
    mode: 'socket',
    module: OrderModule,
  });
  try {
    await request(probe, '/order', ORDER_REQUEST);
    const response = await request(probe, '/orders');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(
      JSON.stringify({ handled: ['placed'] }),
    );
  } finally {
    await probe.close();
  }
});
