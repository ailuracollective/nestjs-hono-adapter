import 'reflect-metadata';

import {
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Query,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { NestRequest } from '#adapter/index';

/** Holds the identifier of the request it was built for. */
@Injectable({ scope: Scope.REQUEST })
class ScopedId {
  /** The identifier the request it was built for carried. */
  public readonly id: string;

  /** Reads the identifier out of the request it was built for. */
  public constructor(@Inject(REQUEST) source: NestRequest) {
    const [, search = ''] = source.originalUrl.split('?');
    this.id = new URLSearchParams(search).get('id') ?? '';
  }
}

/** Answers the identifier its own request carried. */
@Controller()
class ConcurrencyController {
  /** The request-scoped provider the route reads. */
  private readonly scoped: ScopedId;

  public constructor(scoped: ScopedId) {
    this.scoped = scoped;
  }

  /** Answers after yielding, so the requests overlap. */
  @Get('who')
  public async who(
    @Query('id') id: string,
  ): Promise<{ id: string; scoped: string }> {
    await Bun.sleep(1);
    return { id, scoped: this.scoped.id };
  }

  /** Reads the body, so an aborted upload is read too. */
  @Post('echo')
  public echo(@Body() body: unknown): { body: unknown } {
    return { body };
  }
}

/** The module declaring the concurrency controller. */
@Module({
  controllers: [ConcurrencyController],
  providers: [ScopedId],
})
class ConcurrencyModule {}

export { ConcurrencyModule, ScopedId };
