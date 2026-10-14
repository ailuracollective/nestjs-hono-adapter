import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { NestContext } from '@ailura/nestjs-hono-adapter';

import { statusOf, writeHeaders, writeStream } from './apollo-write.ts';

type ApolloBody =
  | {
      readonly kind: 'complete';
      readonly string: string;
    }
  | {
      readonly kind: 'incremental';
      readonly asyncIterator: AsyncIterator<string>;
    };

interface ApolloAnswer {
  readonly body: ApolloBody;
  readonly headers: Iterable<[string, string]>;
  readonly status?: ContentfulStatusCode;
}

const writeAnswer = (context: NestContext, answer: ApolloAnswer): Response => {
  writeHeaders(context, answer.headers);
  const status = statusOf(answer.status);
  const { body } = answer;
  return body.kind === 'complete'
    ? context.newResponse(body.string, status)
    : writeStream(status, body);
};

export { writeAnswer };
export type { ApolloAnswer, ApolloBody };
