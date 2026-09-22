import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { interval, map, take } from 'rxjs';
import type { Observable } from 'rxjs';

@Controller()
export class AppController {

  @Get('health')
  public health(): { ok: boolean; where: string } {
    return { ok: true, where: 'workers' };
  }

  @Get('plain')
  @Header('x-plain', 'yes')
  public plain(): string {
    return 'plain-text';
  }

  @Get('query')
  public query(
    @Query() query: Record<string, unknown>,
  ): Record<string, unknown> {
    return query;
  }

  @Post('echo')
  public echo(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  @Post('form')
  public form(@Body() body: unknown): { received: unknown } {
    return { received: body };
  }

  @Sse('stream')
  public stream(): Observable<{ data: string }> {
    return interval(100).pipe(
      take(3),
      map((index) => ({ data: `frame-${index}` })),
    );
  }
}
