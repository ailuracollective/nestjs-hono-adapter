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
 * Sets the type of the answer, as given. Express also expands a
 * shorthand such as `json` through a media type table; no
 * module registering a route this way uses one.
 */
function type(this: NestContext, value: string): NestContext {
  this.header('content-type', value);
  return this;
}

/**
 * Answers the body, ending the request. The status Nest asked
 * for through the adapter comes first and `200` is the
 * fallback, and the body goes through the writer every other
 * answer does, so the headers recorded so far travel with it.
 */
function send(this: NestContext, body: unknown): NestContext {
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
