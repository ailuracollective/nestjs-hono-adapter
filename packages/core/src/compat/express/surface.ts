import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { ResponseWriter } from '#adapter/core/response/response-writer';

/** The writer Nest's own path records a status against. */
const writer = new ResponseWriter();

/** The content type a string body is labelled with. */
const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

/** The status an answer carries when nothing said otherwise. */
const OK_STATUS: number = HttpStatus.OK;

/** Sets the type of the answer, as given. */
function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

/** Express's label for a string body, unless one was declared. */
const htmlLabel = (
  context: NestContext,
): Record<string, string> =>
  context.res.headers.has('content-type')
    ? {}
    : { 'content-type': HTML_CONTENT_TYPE };

/**
 * The answer Hono's writer produces; `newResponse()`, which
 * imposes no type of its own.
 */
const throughHono = (
  context: NestContext,
  body: unknown,
): Response =>
  typeof body === 'string'
    ? context.newResponse(body, undefined, htmlLabel(context))
    : context.json(body);

/**
 * Answers the body. A status Hono carried out of
 * `res.status(n)` wins over the declared one.
 */
function send(this: NestContext, body: unknown): NestContext {
  const declared = writer.statusOf(this);
  const answered = throughHono(this, body);
  if (
    declared === undefined ||
    declared === OK_STATUS ||
    answered.status !== OK_STATUS
  ) {
    return this;
  }
  writer.reply(this, body, declared);
  return this;
}

/** The members this puts on the context prototype. */
const surface = { send, type };

export { OK_STATUS, surface, writer };
