import { Controller, Get, Module } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

/** The host address a case binds both transports to. */
const LOCALHOST = '127.0.0.1';

/** The port a case asks the system to pick for it. */
const ANY_PORT = 0;

/** The pattern the microservice fixture answers. */
const SUM = 'sum';

/** The first value the fixture is asked to sum. */
const FIRST = 1;

/** The second value the fixture is asked to sum. */
const SECOND = 2;

/** What summing those two values answers. */
const TOTAL = 3;

/** A controller that serves HTTP and a message pattern. */
@Controller()
class HybridController {
  /** Answers with a fixed object. */
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  /** Sums the values it is handed. */
  @MessagePattern(SUM)
  public sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }
}

/** The module that wires the hybrid fixture. */
@Module({ controllers: [HybridController] })
class HybridModule {}

export {
  ANY_PORT,
  FIRST,
  LOCALHOST,
  SECOND,
  SUM,
  TOTAL,
  HybridModule,
};
