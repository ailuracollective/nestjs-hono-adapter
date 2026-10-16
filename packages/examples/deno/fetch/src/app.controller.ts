import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { interval, map, take } from 'rxjs';
import type { Observable } from 'rxjs';

import { TeapotError } from './boom.filter.ts';
import { TokenGuard } from './token.guard.ts';

/** The example controller served by the fetch Worker. */
@Controller()
export class AppController {
  /** Answers a health probe. */
  @Get('health')
  public health(): { ok: boolean; where: string } {
    return { ok: true, where: 'deno' };
  }

  /** Greets the name in the query, or the world. */
  @Get('hello')
  public hello(@Query('name') name?: string): string {
    return `Hello ${name ?? 'world'}!`;
  }

  /** Echoes the query string. */
  @Get('query')
  public query(
    @Query() query: Record<string, unknown>,
  ): Record<string, unknown> {
    return query;
  }

  /** Echoes the JSON body. */
  @Post('echo')
  public echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  /** Streams three SSE frames. */
  @Sse('stream')
  public stream(): Observable<{ data: string }> {
    return interval(100).pipe(
      take(3),
      map((index) => ({ data: `frame-${index}` })),
    );
  }

  /** Reports the client address the adapter read. */
  @Get('whoami')
  public whoami(@Req() request: { ip?: string }): {
    ip: string | null;
  } {
    return { ip: request.ip ?? null };
  }

  /** Guards the route with the example API token. */
  @Get('private')
  @UseGuards(TokenGuard)
  public private_(): { secret: string } {
    return { secret: 'only with x-api-token: let-me-in' };
  }

  /** Throws the error the example filter catches. */
  @Get('boom')
  public boom(): never {
    throw new TeapotError('this one is on purpose');
  }

  /** Reports the byte count of the raw body. */
  @Post('raw')
  public raw(@Req() request: { rawBody?: Uint8Array }): {
    bytes: number;
  } {
    return { bytes: request.rawBody?.length ?? 0 };
  }
}
