import type { ICommand, IEvent, IQuery } from '@nestjs/cqrs';

const GREETING = 'hello from the command bus';

const ANSWER = { doubled: 21 };

const DOUBLED = 10;

class GreetCommand implements ICommand {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

class DoubleQuery implements IQuery {
  public readonly value: number;

  public constructor(value: number) {
    this.value = value;
  }
}

class GreetedEvent implements IEvent {
  public readonly name: string;

  public constructor(name: string) {
    this.name = name;
  }
}

export { ANSWER, DOUBLED, DoubleQuery, GREETING, GreetCommand, GreetedEvent };
