import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { NestContext } from '@ailura/nestjs-hono-adapter';
import { DEFAULT_STATUS } from './peer-shapes.ts';

// Apollo expects a `HeaderMap` (a lowercased `Map` answering `undefined`); WHATWG `Headers` answers
// `null`, which slips through its `!== undefined` checks (the CSRF gate 500s, the GET rule 415s).
class RequestHeaders extends Map<string, string> {
  public constructor(headers: Headers) {
    super();
    for (const [name, value] of headers) {
      super.set(name.toLowerCase(), value);
    }
  }

  public override get(name: string): string | undefined {
    return super.get(name.toLowerCase());
  }

  public override has(name: string): boolean {
    return super.has(name.toLowerCase());
  }
}

const requestHeaders = (context: NestContext): RequestHeaders =>
  new RequestHeaders(new Headers(context.req.raw.headers));

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

export { RequestHeaders, requestHeaders, statusOf, writeHeaders, writeStream };
