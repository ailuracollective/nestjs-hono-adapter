import type { NestContext } from '#adapter/core/context';

const defaultContentType = (headers: Headers, inferred: string): void => {
  if (!headers.has('content-type')) {
    headers.set('content-type', inferred);
  }
};

const setDisposition = (headers: Headers, disposition: string | readonly string[]): void => {
  if (typeof disposition === 'string') {
    headers.append('content-disposition', disposition);
    return;
  }
  for (const value of disposition) {
    headers.append('content-disposition', value);
  }
};

const responseHeaders = (context: NestContext): Headers => context.res.headers;

export { defaultContentType, responseHeaders, setDisposition };
