import { HttpStatus } from '@nestjs/common';

import { buildResponse } from './bridge.ts';
import type { NestContext } from './context.ts';

/**
 * Writes what Nest answers onto the context of the request.
 *
 * A Hono context doubles as the response object, so a value is
 * turned into a Web response and stored on it. A status set
 * through `@HttpCode()` or `@Res()` is remembered per request,
 * because the adapter is asked for it after the handler ran.
 */
class ResponseWriter {
  private readonly pendingStatus = new WeakMap<
    NestContext,
    number
  >();

  public status(
    response: NestContext,
    statusCode: number,
  ): void {
    this.pendingStatus.set(response, statusCode);
  }

  /**
   * The status Nest asked for, before any body was written. An
   * event stream needs it while the handler still runs.
   */
  public statusOf(response: NestContext): number | undefined {
    return this.pendingStatus.get(response);
  }

  public reply(
    response: NestContext,
    body: unknown,
    statusCode?: number,
  ): void {
    response.res = buildResponse(
      response,
      body,
      statusCode ?? this.resolve(response),
    );
  }

  public end(response: NestContext, message?: string): void {
    response.res = buildResponse(
      response,
      message,
      this.resolve(response),
    );
  }

  public redirect(
    response: NestContext,
    statusCode: number,
    url: string,
  ): void {
    response.header('Location', url);
    response.res = buildResponse(
      response,
      undefined,
      statusCode,
    );
  }

  public setHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    response.header(name, value);
  }

  public getHeader(
    response: NestContext,
    name: string,
  ): string | undefined {
    return response.res.headers.get(name) ?? undefined;
  }

  public appendHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    response.header(name, value, { append: true });
  }

  public isHeadersSent(response: NestContext): boolean {
    return response.finalized;
  }

  private resolve(response: NestContext): number {
    return this.pendingStatus.get(response) ?? HttpStatus.OK;
  }
}

export { ResponseWriter };
