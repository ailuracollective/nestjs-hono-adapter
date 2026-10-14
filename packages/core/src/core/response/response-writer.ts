import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { buildResponse } from './response.ts';

const PENDING_STATUS = Symbol('pendingStatus');

const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

interface StatusCarrier {
  [PENDING_STATUS]?: number;
}

const pendingStatusOf = (context: NestContext): number | undefined =>
  (context as NestContext & StatusCarrier)[PENDING_STATUS];

class ResponseWriter {
  public status(response: NestContext, statusCode: number): void {
    const recorded = response as NestContext & StatusCarrier;
    recorded[PENDING_STATUS] = statusCode;
  }

  public statusOf(response: NestContext): number | undefined {
    return pendingStatusOf(response);
  }

  public reply(response: NestContext, body: unknown, statusCode?: number): void {
    response.res = buildResponse(response, body, statusCode ?? this.resolve(response));
  }

  public end(response: NestContext, message?: string): void {
    response.res = buildResponse(response, message, this.resolve(response));
  }

  public view(response: NestContext, html: string): void {
    response.header('content-type', HTML_CONTENT_TYPE);
    this.reply(response, html);
  }

  public redirect(response: NestContext, statusCode: number, url: string): void {
    response.header('Location', url);
    response.res = buildResponse(response, undefined, statusCode);
  }

  public setHeader(response: NestContext, name: string, value: string): void {
    response.header(name, value);
  }

  public getHeader(response: NestContext, name: string): string | undefined {
    return response.res.headers.get(name) ?? undefined;
  }

  public appendHeader(response: NestContext, name: string, value: string): void {
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
