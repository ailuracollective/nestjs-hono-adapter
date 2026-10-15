import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

/** The error the example filter catches. */
export class TeapotError extends Error {}

/** Answers a `TeapotError` with the teapot status. */
@Catch(TeapotError)
@Injectable()
export class BoomFilter implements ExceptionFilter {
  constructor(
    @Inject(HttpAdapterHost) private readonly http: HttpAdapterHost,
  ) {}

  /** Writes the error answer through the HTTP adapter. */
  public catch(exception: TeapotError, host: ArgumentsHost): void {
    this.http.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      {
        statusCode: HttpStatus.I_AM_A_TEAPOT,
        message: 'short and stout',
        detail: exception.message,
      },
      HttpStatus.I_AM_A_TEAPOT,
    );
  }
}
