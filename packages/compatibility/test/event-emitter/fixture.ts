/* eslint-disable typescript/consistent-type-imports */

import 'reflect-metadata';

import { Controller, Get, Injectable, Module, Post } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule, OnEvent } from '@nestjs/event-emitter';

const EVENT = 'adapter.order.placed';

const received: string[] = [];

@Controller()
class OrderController {
  private readonly emitter: EventEmitter2;

  public constructor(emitter: EventEmitter2) {
    this.emitter = emitter;
  }

  @Post('order')
  public place(): { readonly emitted: string } {
    this.emitter.emit(EVENT, 'placed');
    return { emitted: EVENT };
  }

  @Get('orders')
  public orders(): { readonly handled: readonly string[] } {
    return { handled: [...received] };
  }
}

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

export { EVENT, OrderModule, received };
