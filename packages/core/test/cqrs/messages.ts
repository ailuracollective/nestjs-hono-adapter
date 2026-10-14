import type { ICommand, IEvent, IQuery } from '@nestjs/cqrs';

const GREETING = 'hello from the command bus';

/** The answer the query handler gives. */
const ANSWER = { doubled: 21 };

/** The value the query asks about. */
const DOUBLED = 10;

/** What the command asks for. */
class GreetCommand implements ICommand {
  /** The name the command carries. */
  public readonly name: string;

  /** Stores the name. */
  public constructor(name: string) {
    this.name = name;
  }
}

/** What the query asks for. */
class DoubleQuery implements IQuery {
  /** The value to double. */
  public readonly value: number;

  /** Stores the value. */
  public constructor(value: number) {
    this.value = value;
  }
}

/** What the command answers, and what the event carries. */
class GreetedEvent implements IEvent {
  /** The name the event carries. */
  public readonly name: string;

  /** Stores the name. */
  public constructor(name: string) {
    this.name = name;
  }
}

export {
  ANSWER,
  DOUBLED,
  DoubleQuery,
  GREETING,
  GreetCommand,
  GreetedEvent,
};
