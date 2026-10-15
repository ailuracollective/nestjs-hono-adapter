import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { etagFor, isFresh, toEtagMode } from './etag.ts';
import type { EtagMode } from './etag.ts';
import { buildResponse } from './response.ts';

const PENDING_STATUS = Symbol('pendingStatus');

const OK_STATUS: number = HttpStatus.OK;

const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

interface StatusCarrier {
  [PENDING_STATUS]?: number;
}

const pendingStatusOf = (context: NestContext): number | undefined =>
  (context as NestContext & StatusCarrier)[PENDING_STATUS];

class ResponseWriter {
  private mode: EtagMode | false = false;

  // `set('etag', …)`: Express tags a read with the entity tag of the body it is about to send, and
  // answers `304` when the client already has it.
  public useEtag(value: unknown): void {
    this.mode = toEtagMode(value);
  }

  public status(response: NestContext, statusCode: number): void {
    const recorded = response as NestContext & StatusCarrier;
    recorded[PENDING_STATUS] = statusCode;
  }

  public statusOf(response: NestContext): number | undefined {
    return pendingStatusOf(response);
  }

  public reply(response: NestContext, body: unknown, statusCode?: number): void {
    this.answer(response, body, statusCode ?? this.resolve(response));
  }

  public end(response: NestContext, message?: string): void {
    this.answer(response, message, this.resolve(response));
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

  private answer(response: NestContext, body: unknown, status: number): void {
    const tag = this.tagOf(response, body, status);
    if (tag === undefined) {
      response.res = buildResponse(response, body, status);
      return;
    }
    response.header('etag', tag);
    if (isFresh(response.req.header('if-none-match'), tag)) {
      response.res = buildResponse(response, undefined, HttpStatus.NOT_MODIFIED);
      return;
    }
    response.res = buildResponse(response, body, status);
  }

  private tagOf(response: NestContext, body: unknown, status: number): string | undefined {
    if (this.mode === false || status !== OK_STATUS) return undefined;

    const { method } = response.req;
    if (method !== 'GET' && method !== 'HEAD') return undefined;

    return etagFor(body, this.mode);
  }

  private resolve(response: NestContext): number {
    return pendingStatusOf(response) ?? HttpStatus.OK;
  }
}

export { ResponseWriter };
