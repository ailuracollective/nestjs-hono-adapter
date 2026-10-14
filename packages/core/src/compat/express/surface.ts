import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { ResponseWriter } from '#adapter/core/response/response-writer';

const writer = new ResponseWriter();

const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

const OK_STATUS: number = HttpStatus.OK;

function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

const htmlLabel = (context: NestContext): Record<string, string> =>
  context.res.headers.has('content-type') ? {} : { 'content-type': HTML_CONTENT_TYPE };

const throughHono = (context: NestContext, body: unknown): Response =>
  typeof body === 'string'
    ? context.newResponse(body, undefined, htmlLabel(context))
    : context.json(body);

function send(this: NestContext, body: unknown): NestContext {
  const declared = writer.statusOf(this);
  const answered = throughHono(this, body);
  if (declared === undefined || declared === OK_STATUS || answered.status !== OK_STATUS)
    return this;
  writer.reply(this, body, declared);
  return this;
}

const surface = { send, type };

export { OK_STATUS, surface, writer };
