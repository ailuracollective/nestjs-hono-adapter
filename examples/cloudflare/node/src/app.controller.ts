import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { interval, map, take } from 'rxjs';
import type { Observable } from 'rxjs';

import { TeapotError } from './boom.filter.ts';

@Controller()
export class AppController {
  @Get('health')
  public health(): { ok: boolean; where: string } {
    return { ok: true, where: 'workers' };
  }

  @Get('hello')
  public hello(@Query('name') name?: string): string {
    return `Hello ${name ?? 'world'}!`;
  }

  @Post('echo')
  public echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  @Sse('stream')
  public stream(): Observable<{ data: string }> {
    return interval(100).pipe(
      take(3),
      map((index) => ({ data: `frame-${index}` })),
    );
  }

  @Get('boom')
  public boom(): never {
    throw new TeapotError('this one is on purpose');
  }

  @Post('raw')
  public raw(@Req() request: { rawBody?: Uint8Array }): {
    bytes: number;
  } {
    return { bytes: request.rawBody?.length ?? 0 };
  }
}
