import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

/** How many requests a case may make before the guard refuses. */
const LIMIT = 3;

/** How long a window lasts, in milliseconds. */
const TTL = 60_000;

/** The client every request is tracked as. */
const TRACKER = 'the-same-client';

/** How far into the window a case reads the remaining count. */
const TWO_REQUESTS = 2;

/** What the route answers with below the limit. */
const ALLOWED = { allowed: true };

/** The controller the guard protects. */
@Controller()
class ThrottledController {
  /** Answers with the allowed body. */
  @Get('ping')
  public ping(): typeof ALLOWED {
    return ALLOWED;
  }

  /** A route the guard refuses before it is reached. */
  @Get('once')
  public once(): typeof ALLOWED {
    return ALLOWED;
  }
}

/** The application under the guard. */
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
