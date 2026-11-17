import { pipeline, Readable } from 'node:stream';

import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import type { ExecutionContext } from 'hono';

import type { NestHono } from '#adapter/core/context';
import type { Bindings } from '#adapter/core/ports/bindings';
import { NODE_STREAM } from '#adapter/core/response/builders/native-stream';

// A `StreamableFile` carries its source stream under `NODE_STREAM`, and the response built for this
// transport has no Web body: writing the source into the socket is the whole answer.
const nativeFetch =
  (app: NestHono) =>
  async (request: Request, env?: Bindings, executionCtx?: ExecutionContext): Promise<Response> => {
    const response = await app.fetch(request, env, executionCtx);
    const stream: unknown = Reflect.get(response, NODE_STREAM);
    const outgoing = env === undefined ? undefined : env.outgoing;
    if (!(stream instanceof Readable) || outgoing === undefined) return response;
    outgoing.writeHead(response.status, [...response.headers]);
    pipeline(stream, outgoing, (error) => {
      if (error !== null) outgoing.destroy(error);
    });
    return RESPONSE_ALREADY_SENT;
  };

export { nativeFetch };
