import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { DEFAULT_STATUS } from './peer-shapes.ts';

/** The headers of one request, as the engine reads them. */
const requestHeaders = (context: NestContext): Headers =>
  new Headers(context.req.raw.headers);

/**
 * The body of a streaming answer, as a Web stream, pulled chunk
 * by chunk.
 */
const streamOf = (
  iterator: AsyncIterator<string>,
): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      const next = await iterator.next();
      if (next.done === true) {
        controller.close();
        return;
      }
      controller.enqueue(new TextEncoder().encode(next.value));
    },
  });

/** Writes a streaming answer, chunk by chunk, as it arrives. */
const writeStream = (
  status: ContentfulStatusCode,
  body: { readonly asyncIterator: AsyncIterator<string> },
): Response =>
  new Response(streamOf(body.asyncIterator), {
    headers: {
      'content-type': 'application/graphql-response+json',
    },
    status,
  });

/** Copies the engine's response headers onto Hono's answer. */
const writeHeaders = (
  context: NestContext,
  headers: Iterable<[string, string]>,
): void => {
  for (const [name, value] of headers) {
    context.header(name, value);
  }
};

/** The status the engine named, or the one an answer carries. */
const statusOf = (
  status: ContentfulStatusCode | undefined,
): ContentfulStatusCode => status ?? DEFAULT_STATUS;

export { requestHeaders, statusOf, writeHeaders, writeStream };
