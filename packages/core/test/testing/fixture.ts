import 'reflect-metadata';

import {
  Controller,
  Get,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

/** What the guarded route answers with. */
const OPEN = { guarded: true };

/** The interface a listening application answers on. */
const LOCALHOST = '127.0.0.1';

/** The port the system picks for a listener. */
const ANY_PORT = 0;

/** A guard that lets every request through. */
@Injectable()
class OpenGuard implements CanActivate {
  /** Lets the request through. */
  public canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

/** A guard that refuses every request. */
@Injectable()
class RefusingGuard implements CanActivate {
  /** Refuses the request. */
  public canActivate(_context: ExecutionContext): boolean {
    return false;
  }
}

/** The controller the open module declares. */
@Controller()
class TestingController {
  /** Answers with the open body. */
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

/** A controller under a guard of its own. */
@UseGuards(RefusingGuard)
@Controller()
class GuardedController {
  /** Answers with the open body. */
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

/** An application whose guard lets every request through. */
@Module({
  controllers: [TestingController],
  providers: [{ provide: APP_GUARD, useClass: OpenGuard }],
})
class OpenModule {}

/** The same application under a guard a case may override. */
@Module({ controllers: [GuardedController] })
class ClosedModule {}

/** What one request against an application saw. */
interface Answered {
  readonly status: number;
  readonly text: string;
}

export {
  ANY_PORT,
  ClosedModule,
  LOCALHOST,
  OPEN,
  OpenGuard,
  OpenModule,
  RefusingGuard,
  TestingController,
};
export type { Answered };
