import { Controller, Get, Module } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

const LOCALHOST = '127.0.0.1';

const ANY_PORT = 0;

const SUM = 'sum';

const FIRST = 1;

const SECOND = 2;

const TOTAL = 3;

@Controller()
class HybridController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @MessagePattern(SUM)
  public sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }
}

@Module({ controllers: [HybridController] })
class HybridModule {}

export { ANY_PORT, FIRST, LOCALHOST, SECOND, SUM, TOTAL, HybridModule };
