/* eslint-disable typescript/consistent-type-imports */

import {
  CommandHandler,
  EventBus,
  EventsHandler,
  QueryHandler,
} from '@nestjs/cqrs';

import {
  ANSWER,
  DoubleQuery,
  GREETING,
  GreetCommand,
  GreetedEvent,
} from '#adapter-test/cqrs/messages';

import type {
  ICommandHandler,
  IQueryHandler,
} from '@nestjs/cqrs';

/** Publishes an event when the bus executes a command. */
@CommandHandler(GreetCommand)
class GreetCommandHandler implements ICommandHandler<
  GreetCommand,
  string
> {
  /** The event bus the handler publishes on. */
  private readonly events: EventBus;

  /** Stores the injected event bus. */
  public constructor(events: EventBus) {
    this.events = events;
  }

  /** Publishes the command's event and answers the greeting. */
  public async execute(command: GreetCommand): Promise<string> {
    await this.events.publish(new GreetedEvent(command.name));
    return GREETING;
  }
}

/** The query handler the bus reaches. */
@QueryHandler(DoubleQuery)
class DoubleQueryHandler implements IQueryHandler<
  DoubleQuery,
  typeof ANSWER
> {
  /** Answers the query with its doubled value. */
  public execute(_query: DoubleQuery): Promise<typeof ANSWER> {
    return Promise.resolve(ANSWER);
  }
}

/** Records the names every event carries. */
@EventsHandler(GreetedEvent)
class GreetedListener {
  /** The names published so far, in the order they arrived. */
  public static readonly seen: string[] = [];

  /** Records the name the event carries. */
  public handle(event: GreetedEvent): void {
    GreetedListener.seen.push(event.name);
  }
}

export {
  DoubleQueryHandler,
  GreetCommandHandler,
  GreetedListener,
};
