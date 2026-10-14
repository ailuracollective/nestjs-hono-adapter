import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { NestContext } from '@ailura/nestjs-hono-adapter';

import {
  statusOf,
  writeHeaders,
  writeStream,
} from './apollo-write.ts';

/** The two shapes an Apollo answer's body arrives in. */
type ApolloBody =
  | {
      readonly kind: 'complete';
      readonly string: string;
    }
  | {
      readonly kind: 'incremental';
      readonly asyncIterator: AsyncIterator<string>;
    };

/** What Apollo's `executeHTTPGraphQLRequest` answers with. */
interface ApolloAnswer {
  /** The body, either complete or a stream of chunks. */
  readonly body: ApolloBody;
  /** The headers Apollo wants the answer to carry. */
  readonly headers: Iterable<[string, string]>;
  /** The status Apollo named, when it named one. */
  readonly status?: ContentfulStatusCode;
}

/** Writes whatever Apollo answered, complete or streaming. */
const writeAnswer = (
  context: NestContext,
  answer: ApolloAnswer,
): Response => {
  writeHeaders(context, answer.headers);
  const status = statusOf(answer.status);
  const { body } = answer;
  return body.kind === 'complete'
    ? context.newResponse(body.string, status)
    : writeStream(status, body);
};

export { writeAnswer };
export type { ApolloAnswer, ApolloBody };
