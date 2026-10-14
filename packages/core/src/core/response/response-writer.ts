import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { buildResponse } from './response.ts';

/** Where the status Nest asked for is kept. */
const PENDING_STATUS = Symbol('pendingStatus');

/** The label Hono's own `html()` helper gives a rendered page. */
const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

/** A context with somewhere to keep the status. */
interface StatusCarrier {
  [PENDING_STATUS]?: number;
}

/** The status recorded against a context, or nothing. */
const pendingStatusOf = (
  context: NestContext,
): number | undefined =>
  (context as NestContext & StatusCarrier)[PENDING_STATUS];

/** Writes what Nest answers onto the context of the request. */
class ResponseWriter {
  /** Records the status Nest asked for. */
  public status(
    response: NestContext,
    statusCode: number,
  ): void {
    const recorded = response as NestContext & StatusCarrier;
    recorded[PENDING_STATUS] = statusCode;
  }

  /** The status Nest asked for, before any body was written. */
  public statusOf(response: NestContext): number | undefined {
    return pendingStatusOf(response);
  }

  /** Writes the body Nest answered with. */
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

  /** Ends the answer with an optional message. */
  public end(response: NestContext, message?: string): void {
    response.res = buildResponse(
      response,
      message,
      this.resolve(response),
    );
  }

  /** Writes a rendered view with its status. */
  public view(response: NestContext, html: string): void {
    response.header('content-type', HTML_CONTENT_TYPE);
    this.reply(response, html);
  }

  /** Answers with a redirect to a URL. */
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

  /** Sets one response header. */
  public setHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    response.header(name, value);
  }

  /** Reads one response header. */
  public getHeader(
    response: NestContext,
    name: string,
  ): string | undefined {
    return response.res.headers.get(name) ?? undefined;
  }

  /** Appends one value to a response header. */
  public appendHeader(
    response: NestContext,
    name: string,
    value: string,
  ): void {
    response.header(name, value, { append: true });
  }

  /** Whether the response has been sent. */
  public isHeadersSent(response: NestContext): boolean {
    return response.finalized;
  }

  /** The status the answer carries. */
  private resolve(response: NestContext): number {
    return pendingStatusOf(response) ?? HttpStatus.OK;
  }
}

export { ResponseWriter };
