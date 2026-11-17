import { pipeline, Readable } from 'node:stream';

import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import type { ExecutionContext } from 'hono';

import type { NestHono } from '#adapter/core/context';
import type { Bindings } from '#adapter/core/ports/bindings';
import { NODE_STREAM } from '#adapter/core/response/builders/native-stream';

const headersOf = (response: Response): string[] => {
  const headerList: string[] = [];
  for (const [name, value] of response.headers) {
    if (name.toLowerCase() !== 'set-cookie') headerList.push(name, value);
  }
  for (const cookie of response.headers.getSetCookie()) {
    headerList.push('set-cookie', cookie);
  }
  return headerList;
};

// A `StreamableFile` carries its source stream under `NODE_STREAM`, and the response built for this
// transport has no Web body: writing the source into the socket is the whole answer.
const nativeFetch =
  (app: NestHono) =>
  async (request: Request, env?: Bindings, executionCtx?: ExecutionContext): Promise<Response> => {
    const response = await app.fetch(request, env, executionCtx);
    const stream: unknown = Reflect.get(response, NODE_STREAM);
    const outgoing = env === undefined ? undefined : env.outgoing;
    if (!(stream instanceof Readable) || outgoing === undefined) return response;
    if (request.method === 'HEAD') {
      stream.destroy();
      return new Response(undefined, { headers: response.headers, status: response.status });
    }
    outgoing.writeHead(response.status, headersOf(response));
    pipeline(stream, outgoing, (error) => {
      if (error !== null) outgoing.destroy(error);
    });
    return RESPONSE_ALREADY_SENT;
  };

export { nativeFetch };
