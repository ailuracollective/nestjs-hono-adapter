/**
 * The cases that show `@nestjs/cqrs` works on this adapter.
 *
 * The package answers a request through three buses rather than
 * through the handler's own return value: a command executed by
 * the command bus, a query answered by the query bus, and an
 * event published on the event bus. What the adapter has to
 * carry is the same in each — a handler's result reaches the
 * caller as the answer — with one difference worth naming:
 * `CommandBus.execute` and `QueryBus.execute` hand back a
 * promise, so the route's response is awaited rather than
 * returned.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Module,
  Post,
} from '@nestjs/common';

import {
  CommandBus,
  CommandHandler,
  CqrsModule,
  EventBus,
  EventsHandler,
  QueryBus,
  QueryHandler,
} from '@nestjs/cqrs';
import type {
  ICommand,
  ICommandHandler,
  IEvent,
  IQuery,
  IQueryHandler,
} from '@nestjs/cqrs';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** The greeting the command handler answers with. */
const GREETING = 'hello from the command bus';

/** The answer the query handler gives. */
const ANSWER = { doubled: 21 };

/** The value the query asks about. */
const DOUBLED = 10;

/** What the command asks for. */
class GreetCommand implements ICommand {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

/** What the query asks for. */
class DoubleQuery implements IQuery {
  public readonly value: number;

  public constructor(value: number) {
    this.value = value;
  }
}

/** What the command answers, and what the event carries. */
class GreetedEvent implements IEvent {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

@Controller()
class CqrsController {
  private readonly commands: CommandBus;
  private readonly events: EventBus;
  private readonly queries: QueryBus;

  public constructor(
    commands: CommandBus,
    queries: QueryBus,
    events: EventBus,
  ) {
    this.commands = commands;
    this.queries = queries;
    this.events = events;
  }

  /**
   * A route whose whole work happens on a bus. The handler is
   * elsewhere and the answer comes back through the promise the
   * bus returns, which is what makes this worth a case: the
   * adapter has to wait for a promise the handler never returns
   * itself.
   */
  @Post('greet')
  public async greet(
    @Body() body: { readonly name: string },
  ): Promise<{
    readonly greeting: string;
  }> {
    await this.commands.execute(new GreetCommand(body.name));
    return { greeting: GREETING };
  }

  /** A route answered by a query handler rather than by itself. */
  @Get('double')
  public double(): Promise<unknown> {
    return this.queries.execute(new DoubleQuery(DOUBLED));
  }

  /**
   * A route that publishes an event and answers what it
   * published.
   */
  @Get('publish')
  public async publish(): Promise<{
    readonly published: string;
  }> {
    await this.events.publish(new GreetedEvent('nest'));
    return { published: 'yes' };
  }
}

/**
 * What the command bus reaches when the route executes a
 * command.
 */
@CommandHandler(GreetCommand)
class GreetCommandHandler implements ICommandHandler<
  GreetCommand,
  string
> {
  private readonly events: EventBus;

  public constructor(events: EventBus) {
    this.events = events;
  }

  public async execute(command: GreetCommand): Promise<string> {
    await this.events.publish(new GreetedEvent(command.name));
    return GREETING;
  }
}

/** What the query bus reaches when the route asks a question. */
@QueryHandler(DoubleQuery)
class DoubleQueryHandler implements IQueryHandler<
  DoubleQuery,
  typeof ANSWER
> {
  public execute(_query: DoubleQuery): Promise<typeof ANSWER> {
    return Promise.resolve(ANSWER);
  }
}

/**
 * What the event bus reaches, holding the names every handler
 * above published: a case reads them to show the events reached
 * a listener rather than stopping at the publisher.
 */
@EventsHandler(GreetedEvent)
class GreetedListener {
  /** The names published so far, in the order they arrived. */
  public static readonly seen: string[] = [];

  public handle(event: GreetedEvent): void {
    GreetedListener.seen.push(event.name);
  }
}

@Module({
  controllers: [CqrsController],
  imports: [CqrsModule.forRoot()],
  providers: [
    GreetCommandHandler,
    DoubleQueryHandler,
    GreetedListener,
  ],
})
class CqrsModuleFixture {}

/** The request a case posts to the command route. */
const COMMAND_REQUEST = {
  body: JSON.stringify({ name: 'nest' }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
};

/** Starts the fixture and hands it to the case. */
async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  GreetedListener.seen.length = 0;
  const probe = await startProbe({
    mode: 'in-process',
    module: CqrsModuleFixture,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('a route answers through a command the bus executed', async () => {
  await withProbe(async (probe) => {
    const response = await request(
      probe,
      '/greet',
      COMMAND_REQUEST,
    );

    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ greeting: GREETING });
  });
});

test('a route answers with what a query handler answered', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/double');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual(ANSWER);
  });
});

test('an event published by a command reaches a listener', async () => {
  await withProbe(async (probe) => {
    await request(probe, '/greet', COMMAND_REQUEST);

    expect(GreetedListener.seen).toStrictEqual(['nest']);
  });
});

test('an event published by a route reaches a listener', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/publish');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ published: 'yes' });
    expect(GreetedListener.seen).toStrictEqual(['nest']);
  });
});

test('the buses answer over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: CqrsModuleFixture,
  });
  try {
    const response = await request(probe, '/double');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(JSON.stringify(ANSWER));
  } finally {
    await probe.close();
  }
});
