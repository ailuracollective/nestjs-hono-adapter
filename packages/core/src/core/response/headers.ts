import type { NestContext } from '#adapter/core/context';

/**
 * Labels the answer with the inferred type, unless one is
 * declared.
 */
const defaultContentType = (
  headers: Headers,
  inferred: string,
): void => {
  if (!headers.has('content-type')) {
    headers.set('content-type', inferred);
  }
};

/** Writes the disposition a file declares. */
const setDisposition = (
  headers: Headers,
  disposition: string | readonly string[],
): void => {
  if (typeof disposition === 'string') {
    headers.append('content-disposition', disposition);
    return;
  }
  for (const value of disposition) {
    headers.append('content-disposition', value);
  }
};

/** The headers the answer already carries on the context. */
const responseHeaders = (context: NestContext): Headers =>
  context.res.headers;

export { defaultContentType, responseHeaders, setDisposition };
