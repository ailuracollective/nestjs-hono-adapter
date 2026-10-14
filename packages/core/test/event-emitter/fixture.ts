/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import {
  Controller,
  Get,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import {
  EventEmitter2,
  EventEmitterModule,
  OnEvent,
} from '@nestjs/event-emitter';

/** The event name a case emits and a listener answers. */
const EVENT = 'adapter.order.placed';

/** What a listener records, and a route reads back. */
const received: string[] = [];

/** Answers routes by emitting on the event bus. */
@Controller()
class OrderController {
  /** The emitter routes publish through. */
  private readonly emitter: EventEmitter2;

  /** Stores the injected emitter. */
  public constructor(emitter: EventEmitter2) {
    this.emitter = emitter;
  }

  /** Emits the event and answers with what it emitted. */
  @Post('order')
  public place(): { readonly emitted: string } {
    this.emitter.emit(EVENT, 'placed');
    return { emitted: EVENT };
  }

  /** Answers with what the listeners recorded. */
  @Get('orders')
  public orders(): { readonly handled: readonly string[] } {
    return { handled: [...received] };
  }
}

/** A listener the decorator registers. */
@Injectable()
class OrderListener {
  /** Records the payload the event carried. */
  @OnEvent(EVENT)
  public handle(payload: string): void {
    received.push(payload);
  }
}

/** The module that wires the event emitter fixture. */
@Module({
  controllers: [OrderController],
  imports: [EventEmitterModule.forRoot()],
  providers: [OrderListener],
})
class OrderModule {}

export { EVENT, OrderModule, received };
