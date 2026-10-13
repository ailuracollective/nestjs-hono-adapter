import type { NestContext } from './context.ts';
import { ResponseWriter } from './response-writer.ts';

/**
 * The response surface a Nest module writes to when it
 * registers a route on the adapter itself.
 * `SwaggerModule.setup()` answers its pages by handing the
 * adapter handlers of the Express shape (`res.type(...)`,
 * `res.send(...)`), and Nest passes the Hono context as that
 * `res` — which has neither member, so the first page asked for
 * answered `500` instead of the UI. The same holds for any
 * module that writes a route this way, which is why this
 * belongs to the translation rather than to Swagger on its
 * own.
 *
 * The pair goes on the prototype rather than on each context,
 * for the reason the SSE `raw` getter does: two function
 * objects per request would be spent on an application that
 * registers no such route. Here they are paid once per
 * process.
 */

/**
 * The writer every method below hands the context it writes to,
 * so one instance serves every request.
 */
const writer = new ResponseWriter();

/**
 * The type Express reads a string body written with `send()`
 * as.
 */
const HTML_CONTENT_TYPE = 'text/html; charset=UTF-8';

/**
 * Sets the type of the answer, as given. Express also expands a
 * shorthand such as `json` through a media type table; no
 * module registering a route this way uses one.
 */
function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

/**
 * Labels a string body as the document Express reads it as.
 * `res.send()` has no other way to say so, and a type the
 * caller declared through `res.type()` is left alone: that is
 * the caller's own answer, under the same rule every other
 * answer follows.
 */
function labelAsHtml(context: NestContext): void {
  if (context.res.headers.has('content-type')) {
    return;
  }
  context.header('content-type', HTML_CONTENT_TYPE);
}

/**
 * Answers the body, ending the request. The status Nest asked
 * for through the adapter comes first and `200` is the
 * fallback, and the body goes through the writer every other
 * answer does, so the headers recorded so far travel with it.
 *
 * A string goes out as `text/html` unless a type was declared
 * first. That is Express's own reading of `res.send(html)` and
 * it is what the surface exists to reproduce: a module that
 * registers a route here and hands over a page means it as a
 * document. The answer a Nest handler _returns_ is labelled by
 * the writer instead, which is the Fastify reading
 * `docs/platform-differences.md` records.
 */
function send(this: NestContext, body: unknown): NestContext {
  if (typeof body === 'string') {
    labelAsHtml(this);
  }
  writer.reply(this, body);
  return this;
}

/**
 * Puts `type` and `send` on Hono's context, once, so no request
 * defines them. The prototype is the check rather than a
 * remembered set: a context answering `send` already carries
 * the surface, which covers a second application in the same
 * process.
 */
function installExpressSurface(context: NestContext): void {
  const prototype: object | null =
    Reflect.getPrototypeOf(context);
  if (prototype === null || 'send' in prototype) {
    return;
  }
  Object.assign(prototype, { send, type });
}

export { installExpressSurface };
