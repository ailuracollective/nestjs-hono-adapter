import type { NestContext } from '#adapter/core/context';
import { ResponseWriter } from '#adapter/core/response/response-writer';

/** The writer shared by every request. */
const writer = new ResponseWriter();

/** The content type a string body is labelled with. */
const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

/** Sets the type of the answer, as given. */
function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

/** Labels a string body as HTML unless a type was declared. */
const labelAsHtml = (context: NestContext): void => {
  if (context.res.headers.has('content-type')) {
    return;
  }
  context.header('content-type', HTML_CONTENT_TYPE);
};

/** Answers the body, ending the request. */
function send(this: NestContext, body: unknown): NestContext {
  if (typeof body === 'string') {
    labelAsHtml(this);
  }
  writer.reply(this, body);
  return this;
}

/** Puts `type` and `send` on Hono's context prototype, once. */
const installExpressSurface = (context: NestContext): void => {
  const prototype: object | null =
    Reflect.getPrototypeOf(context);
  if (prototype === null || 'send' in prototype) {
    return;
  }
  Object.assign(prototype, { send, type });
};

export { installExpressSurface };
