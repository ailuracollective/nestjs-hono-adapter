import { RequestCarrier } from '#adapter/core/ports/bindings';
import type { Bindings } from '#adapter/core/ports/bindings';
import { SYNTHETIC_SERVER } from '#test/bun-bindings';
import { startProbe } from '#test/probe';
import type { Probe } from '#test/probe';
import { SseModule } from '#adapter-test/support/sse-controller';

import { collect, framesOf, nextChunk } from './frames.ts';
import { FRAME_TIMEOUT, decoder } from './types.ts';
import type { BodyReader } from './types.ts';

/** Reads one frame, so a disconnect can be issued mid-stream. */
const readOnce = async (
  reader: BodyReader,
  ms: number,
): Promise<string> => {
  const chunk = await nextChunk(reader, Date.now() + ms);
  if (chunk.done || chunk.value === undefined) {
    throw new Error('The stream ended before a frame arrived.');
  }
  return decoder.decode(chunk.value);
};

/** The body of a response, or a failure when there is none. */
const bodyOf = (
  response: Response,
): ReadableStream<Uint8Array> => {
  const { body } = response;
  if (body === null) {
    throw new TypeError('The response has no streamed body.');
  }
  return body;
};

/** Opens a stream and reads its first frame. */
const openStream = async (
  probe: Probe,
  route: string,
): Promise<AbortController> => {
  const client = new AbortController();
  const response = await probe.respond(route, {
    signal: client.signal,
  });
  await readOnce(bodyOf(response).getReader(), FRAME_TIMEOUT);
  return client;
};

/** Asks one route and reads the whole stream it answers. */
const streamText = async (
  probe: Probe,
  route: string,
): Promise<string> => {
  const response = await probe.respond(route);
  return framesOf(
    await collect(bodyOf(response), FRAME_TIMEOUT),
  );
};

/** A probe with no listener, no port and no teardown. */
const streamedProbe = (): Promise<Probe> =>
  startProbe({ mode: 'in-process', module: SseModule });

/** Sends a request over the carrier Bun hands the adapter. */
const respondOverBareSocket = async (
  probe: Probe,
  path: string,
): Promise<{
  readonly incoming: RequestCarrier;
  readonly response: Response;
}> => {
  const incoming = new RequestCarrier(undefined);
  const binding = {
    incoming,
    server: SYNTHETIC_SERVER,
  } satisfies Bindings;
  const response = await probe.adapter
    .getHono()
    .request(path, undefined, binding);
  return { incoming, response };
};

export {
  bodyOf,
  openStream,
  readOnce,
  respondOverBareSocket,
  streamText,
  streamedProbe,
};
