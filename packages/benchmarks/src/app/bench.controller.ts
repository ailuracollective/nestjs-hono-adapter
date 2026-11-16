import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Readable } from 'node:stream';

import { BenchGuard } from './bench.guard.ts';
import { BenchInterceptor } from './bench.interceptor.ts';

/** The non-Inertia routes every benchmark target serves. */
@Controller()
export class BenchController {
  /** Plaintext routing and keep-alive probe. */
  @Get('health')
  public health(): string {
    return 'OK';
  }

  /** Minimal JSON serialization benchmark route. */
  @Get('hello')
  public hello(): { message: string } {
    return { message: 'Hello world!' };
  }

  /**
   * Query string parsing benchmark route.
   *
   * @param name - Optional query name.
   * @param limit - Optional query limit.
   */
  @Get('query')
  public query(
    @Query('name') name?: string,
    @Query('limit') limit?: string,
  ): { limit: number; name: string } {
    return { limit: Number(limit ?? 0), name: name ?? 'world' };
  }

  /**
   * Route parameter parsing benchmark route.
   *
   * @param id - URL path parameter.
   */
  @Get('users/:id')
  public user(@Param('id') id: string): { id: string } {
    return { id };
  }

  /**
   * Body parsing and re-serialization benchmark route.
   *
   * @param body - The parsed request body.
   */
  @Post('echo')
  public echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  /** Pipeline benchmark route with guard and interceptor. */
  @Get('pipeline')
  @UseGuards(BenchGuard)
  @UseInterceptors(BenchInterceptor)
  public pipeline(): { ok: true } {
    return { ok: true };
  }

  /** Parameter validation through a stock Nest pipe. */
  @Get('pipes/:id')
  public pipes(@Param('id', ParseIntPipe) id: number): { id: number } {
    return { id };
  }

  /** Route behind a scoped Nest middleware. */
  @Get('middleware')
  public middleware(): { ok: true } {
    return { ok: true };
  }

  /** A finite Node stream, also served by the Bun transport. */
  @Get('stream')
  public stream(): StreamableFile {
    return new StreamableFile(Readable.from(['hello', ' world']));
  }

  /**
   * Exception handling benchmark route.
   *
   * @throws HttpException with 418 I_AM_A_TEAPOT status.
   */
  @Get('boom')
  public boom(): never {
    throw new HttpException('the bench teapot', HttpStatus.I_AM_A_TEAPOT);
  }
}
