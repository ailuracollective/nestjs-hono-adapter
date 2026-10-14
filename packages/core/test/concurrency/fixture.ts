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

@Injectable({ scope: Scope.REQUEST })
class ScopedId {
  public readonly id: string;

  public constructor(@Inject(REQUEST) source: NestRequest) {
    const [, search = ''] = source.originalUrl.split('?');
    this.id = new URLSearchParams(search).get('id') ?? '';
  }
}

@Controller()
class ConcurrencyController {
  private readonly scoped: ScopedId;

  public constructor(scoped: ScopedId) {
    this.scoped = scoped;
  }

  @Get('who')
  public async who(@Query('id') id: string): Promise<{ id: string; scoped: string }> {
    await Bun.sleep(1);
    return { id, scoped: this.scoped.id };
  }

  @Post('echo')
  public echo(@Body() body: unknown): { body: unknown } {
    return { body };
  }
}

@Module({
  controllers: [ConcurrencyController],
  providers: [ScopedId],
})
class ConcurrencyModule {}

export { ConcurrencyModule, ScopedId };
