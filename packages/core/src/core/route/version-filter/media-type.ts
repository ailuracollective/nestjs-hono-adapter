import type { NestRequest } from '#adapter/core/request/request';

import { readHeader } from './match.ts';

/** The parameters of one media range, trimmed. */
const parametersOf = (mediaRange: string): string[] => {
  const [, ...parameters] = mediaRange.split(';');
  return parameters.map((parameter) => parameter.trim());
};

/** Matches the trailing plus of a media-type key. */
const TRAILING_PLUS = /\+$/u;

/** Reads the version one media range names. */
const versionInRange = (
  mediaRange: string,
  name: string,
): string | undefined => {
  for (const parameter of parametersOf(mediaRange)) {
    const [supplied, value] = parameter.split('=');
    if (supplied === name && value !== undefined) {
      return value;
    }
  }
  return undefined;
};

/** Reads the version an `Accept` header carries. */
const readMediaTypeVersion = (
  request: NestRequest,
  key: string,
): string | undefined => {
  const accept = readHeader(request, 'accept');
  if (accept === undefined) {
    return undefined;
  }
  const name = (key.split('=')[0] ?? key).replace(
    TRAILING_PLUS,
    '',
  );
  for (const mediaRange of accept.split(',')) {
    const version = versionInRange(mediaRange, name);
    if (version !== undefined) {
      return version;
    }
  }
  return undefined;
};

export { readMediaTypeVersion };
