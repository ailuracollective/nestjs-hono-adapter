import type { NestContext } from '@ailura/nestjs-hono-adapter';

import type { Handler } from './mount-roots.ts';

const NOT_FOUND = 404;

const asHtml = (result: Response): Response => {
  const type = result.headers.get('content-type');
  if (type === null || !type.startsWith('application/octet-stream')) {
    return result;
  }
  const headers = new Headers(result.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(result.body, {
    headers,
    status: result.status,
    statusText: result.statusText,
  });
};

const answerMiss = (context: NestContext, result: unknown, fallthrough: boolean): unknown => {
  if (fallthrough || context.finalized) return result;
  return new Response('Not Found', { status: NOT_FOUND });
};

const normaliseIndexType = (serve: Handler, fallthrough: boolean): Handler => {
  const answering = async (context: NestContext, next: () => Promise<void>): Promise<unknown> => {
    const onward = fallthrough ? next : (): Promise<void> => Promise.resolve();
    const result = await serve(context, onward);
    if (result instanceof Response) return asHtml(result);
    return answerMiss(context, result, fallthrough);
  };
  return answering;
};

export { normaliseIndexType };
