import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { DEFAULT_STATUS } from './peer-shapes.ts';

const requestHeaders = (context: NestContext): Headers => new Headers(context.req.raw.headers);

const streamOf = (iterator: AsyncIterator<string>): ReadableStream<Uint8Array> =>
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

const writeHeaders = (context: NestContext, headers: Iterable<[string, string]>): void => {
  for (const [name, value] of headers) {
    context.header(name, value);
  }
};

const statusOf = (status: ContentfulStatusCode | undefined): ContentfulStatusCode =>
  status ?? DEFAULT_STATUS;

export { requestHeaders, statusOf, writeHeaders, writeStream };
