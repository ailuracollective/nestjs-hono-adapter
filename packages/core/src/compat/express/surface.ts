import type { NestContext } from '#adapter/core/context';
import { ResponseWriter } from '#adapter/core/response/response-writer';
import { fitExtras } from './surface-extras.ts';

const writer = new ResponseWriter();

const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

// Express labels a string body it was not told a type for as HTML; the Nest path labels it text/plain.
const send = (context: NestContext, owned: ResponseWriter, body: unknown): NestContext => {
  if (typeof body === 'string' && !context.res.headers.has('content-type')) {
    context.header('content-type', HTML_CONTENT_TYPE);
  }
  owned.reply(context, body, owned.statusOf(context));
  return context;
};

const STATUS = Symbol('honoStatus');

type StatusSetter = (this: NestContext, code: number) => void;

interface ResponseSurface {
  [STATUS]?: StatusSetter;
  status: (code: number) => NestContext;
  send: (body: unknown) => NestContext;
  type: (value: string) => NestContext;
  set: (field: string | Record<string, string>, value?: string) => NestContext;
  append: (field: string, value: string) => NestContext;
}

function status(this: NestContext, code: number): NestContext {
  const honoStatus = (this as NestContext & { [STATUS]?: StatusSetter })[STATUS];
  if (honoStatus !== undefined) honoStatus.call(this, code);
  // Hono keeps the status in a private field `res` does not report, and `send` reads it here.
  writer.status(this, code);
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

// Fitted on the request's own context, once per request (see `surface-fit.ts`), so no Hono
// prototype is written to and two applications in one process cannot see each other's members.
const fitResponse = (context: NestContext, owned: ResponseWriter): void => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fitted surface layers the Express response dialect onto the Hono context.
  const target = context as unknown as ResponseSurface;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Hono types `status` with the StatusCode union; the fitted surface widens it to any number, matching Express.
  target[STATUS] = context.status as unknown as StatusSetter;
  target.status = status;
  target.send = (body: unknown): NestContext => send(context, owned, body);
  target.type = type;
  target.set = set;
  target.append = append;
  fitExtras(context);
};

export { fitResponse, writer };
