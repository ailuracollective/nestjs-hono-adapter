/* eslint-disable typescript/consistent-type-imports */

import { CommandHandler, EventBus, EventsHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ANSWER,
  DoubleQuery,
  GREETING,
  GreetCommand,
  GreetedEvent,
} from '#adapter-test/cqrs/messages';

import type { ICommandHandler, IQueryHandler } from '@nestjs/cqrs';

@CommandHandler(GreetCommand)
class GreetCommandHandler implements ICommandHandler<GreetCommand, string> {
  private readonly events: EventBus;

  public constructor(events: EventBus) {
    this.events = events;
  }

  public async execute(command: GreetCommand): Promise<string> {
    await this.events.publish(new GreetedEvent(command.name));
    return GREETING;
  }
}

@QueryHandler(DoubleQuery)
class DoubleQueryHandler implements IQueryHandler<DoubleQuery, typeof ANSWER> {
  public execute(_query: DoubleQuery): Promise<typeof ANSWER> {
    return Promise.resolve(ANSWER);
  }
}

@EventsHandler(GreetedEvent)
class GreetedListener {
  public static readonly seen: string[] = [];

  public handle(event: GreetedEvent): void {
    GreetedListener.seen.push(event.name);
  }
}

export { DoubleQueryHandler, GreetCommandHandler, GreetedListener };
