import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const LIMIT = 3;

const TTL = 60_000;

const TRACKER = 'the-same-client';

const TWO_REQUESTS = 2;

const ALLOWED = { allowed: true };

@Controller()
class ThrottledController {
  @Get('ping')
  public ping(): typeof ALLOWED {
    return ALLOWED;
  }

  @Get('once')
  public once(): typeof ALLOWED {
    return ALLOWED;
  }
}

@Module({
  controllers: [ThrottledController],
  imports: [
    ThrottlerModule.forRoot([
      {
        getTracker: (): string => TRACKER,
        limit: LIMIT,
        ttl: TTL,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottledModule {}

export { ALLOWED, LIMIT, TWO_REQUESTS, ThrottledModule };
