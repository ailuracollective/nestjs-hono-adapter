import { HttpStatus } from '@nestjs/common';

import type { NestContext } from './context.ts';
import { buildResponse } from './response.ts';

/**
 * Where the status Nest asked for is kept until the answer is
 * built: a property on the context rather than a `WeakMap`
 * beside it, since both live exactly as long as the context
 * does and one is a write to an object that already exists.
 */
const PENDING_STATUS = Symbol('pendingStatus');

/**
 * A context with somewhere to keep the status. Written as an
 * interface extending the context rather than a bare record so
 * the assertion to it is one the checker can see is a
 * widening.
 */
interface StatusCarrier {
  [PENDING_STATUS]?: number;
}

/** The status recorded against a context, or nothing. */
function pendingStatusOf(
  context: NestContext,
): number | undefined {
  return (context as NestContext & StatusCarrier)[
    PENDING_STATUS
  ];
}

/**
 * Writes what Nest answers onto the context of the request. A
 * Hono context doubles as the response object, so a value is
 * turned into a Web response and stored on it. A status set
 * through `@HttpCode()` or `@Res()` is remembered per request,
 * because the adapter is asked for it after the handler ran.
 */
class ResponseWriter {
  public status(
    response: NestContext,
    statusCode: number,
  ): void {
    const recorded = response as NestContext & StatusCarrier;
    recorded[PENDING_STATUS] = statusCode;
  }

  /**
   * The status Nest asked for, before any body was written; an
   * event stream needs it while the handler still runs.
   */
  public statusOf(response: NestContext): number | undefined {
    return pendingStatusOf(response);
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
    return pendingStatusOf(response) ?? HttpStatus.OK;
  }
}

export { ResponseWriter };
