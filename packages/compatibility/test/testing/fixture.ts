import 'reflect-metadata';

import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

const OPEN = { guarded: true };

const LOCALHOST = '127.0.0.1';

const ANY_PORT = 0;

@Injectable()
class OpenGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

@Injectable()
class RefusingGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return false;
  }
}

@Controller()
class TestingController {
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

@UseGuards(RefusingGuard)
@Controller()
class GuardedController {
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

@Module({
  controllers: [TestingController],
  providers: [{ provide: APP_GUARD, useClass: OpenGuard }],
})
class OpenModule {}

@Module({ controllers: [GuardedController] })
class ClosedModule {}

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
