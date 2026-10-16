import type { NestRequest } from '#adapter/core/request/request';

const parametersOf = (mediaRange: string): string[] => {
  const [, ...parameters] = mediaRange.split(';');
  return parameters.map((parameter) => parameter.trim());
};

const TRAILING_PLUS = /\+$/u;

const versionInRange = (mediaRange: string, name: string): string | undefined => {
  for (const parameter of parametersOf(mediaRange)) {
    const [supplied, value] = parameter.split('=');
    if (supplied === name && value !== undefined) return value;
  }
  return undefined;
};

const readMediaTypeVersion = (request: NestRequest, key: string): string | undefined => {
  const accept = request.get('accept');
  if (accept === undefined) return undefined;
  const name = (key.split('=')[0] ?? key).replace(TRAILING_PLUS, '');
  for (const mediaRange of accept.split(',')) {
    const version = versionInRange(mediaRange, name);
    if (version !== undefined) return version;
  }
  return undefined;
};

export { readMediaTypeVersion };
