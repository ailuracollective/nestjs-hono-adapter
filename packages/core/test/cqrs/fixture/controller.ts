/* eslint-disable typescript/consistent-type-imports */

import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';

import {
  DOUBLED,
  DoubleQuery,
  GREETING,
  GreetCommand,
  GreetedEvent,
} from '#adapter-test/cqrs/messages';

/** Answers routes through the CQRS buses. */
@Controller()
class CqrsController {
  /** The command bus routes execute on. */
  private readonly commands: CommandBus;
  /** The event bus routes publish on. */
  private readonly events: EventBus;
  /** The query bus routes ask on. */
  private readonly queries: QueryBus;

  /** Stores the injected buses. */
  public constructor(
    commands: CommandBus,
    queries: QueryBus,
    events: EventBus,
  ) {
    this.commands = commands;
    this.queries = queries;
    this.events = events;
  }

  /** Answers after executing a command on the bus. */
  @Post('greet')
  public async greet(
    @Body() body: { readonly name: string },
  ): Promise<{
    readonly greeting: string;
  }> {
    await this.commands.execute(new GreetCommand(body.name));
    return { greeting: GREETING };
  }

  /** A route answered by a query handler. */
  @Get('double')
  public double(): Promise<unknown> {
    return this.queries.execute(new DoubleQuery(DOUBLED));
  }

  /** Publishes an event and answers that it did. */
  @Get('publish')
  public async publish(): Promise<{
    readonly published: string;
  }> {
    await this.events.publish(new GreetedEvent('nest'));
    return { published: 'yes' };
  }
}

export { CqrsController };
