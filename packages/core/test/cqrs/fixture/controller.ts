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

@Controller()
class CqrsController {
  private readonly commands: CommandBus;
  private readonly events: EventBus;
  private readonly queries: QueryBus;

  public constructor(commands: CommandBus, queries: QueryBus, events: EventBus) {
    this.commands = commands;
    this.queries = queries;
    this.events = events;
  }

  @Post('greet')
  public async greet(@Body() body: { readonly name: string }): Promise<{
    readonly greeting: string;
  }> {
    await this.commands.execute(new GreetCommand(body.name));
    return { greeting: GREETING };
  }

  @Get('double')
  public double(): Promise<unknown> {
    return this.queries.execute(new DoubleQuery(DOUBLED));
  }

  @Get('publish')
  public async publish(): Promise<{
    readonly published: string;
  }> {
    await this.events.publish(new GreetedEvent('nest'));
    return { published: 'yes' };
  }
}

export { CqrsController };
