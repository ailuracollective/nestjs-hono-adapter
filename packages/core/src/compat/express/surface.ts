import { HttpStatus } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import { isBinaryBody } from '#adapter/core/response/builders/content';
import { ResponseWriter } from '#adapter/core/response/response-writer';
import { fitExtras } from './surface-extras.ts';

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
  if (isBinaryBody(body)) {
    writer.reply(this, body);
    return this;
  }
  const answered = throughHono(this, body);
  if (declared === undefined || declared === OK_STATUS || answered.status !== OK_STATUS)
    return this;
  writer.reply(this, body, declared);
  return this;
}

const STATUS = Symbol('honoStatus');

type StatusSetter = (this: NestContext, code: number) => void;

interface ResponseSurface {
  [STATUS]?: StatusSetter;
  status: (code: number) => NestContext;
  set: (field: string | Record<string, string>, value?: string) => NestContext;
  append: (field: string, value: string) => NestContext;
}

function status(this: NestContext, code: number): NestContext {
  const honoStatus = (this as NestContext & { [STATUS]?: StatusSetter })[STATUS];
  if (honoStatus !== undefined) honoStatus.call(this, code);
  return this;
}

function set(
  this: NestContext,
  field: string | Record<string, string>,
  value?: string,
): NestContext {
  if (typeof field === 'string') {
    if (value !== undefined) this.header(field, value);
    return this;
  }
  for (const [name, header] of Object.entries(field)) {
    this.header(name, header);
  }
  return this;
}

function append(this: NestContext, field: string, value: string): NestContext {
  this.header(field, value, { append: true });
  return this;
}

const surface = { send, type };

const fitResponse = (context: NestContext): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted surface layers the Express response dialect onto the Hono context.
  const target = context as unknown as ResponseSurface;
  if (target[STATUS] === undefined) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Hono types `status` with the StatusCode union; the fitted surface widens it to any number, matching Express.
    target[STATUS] = context.status as unknown as StatusSetter;
    target.status = status;
  }
  target.set = set;
  target.append = append;
  fitExtras(context);
};

export { OK_STATUS, fitResponse, surface, writer };
