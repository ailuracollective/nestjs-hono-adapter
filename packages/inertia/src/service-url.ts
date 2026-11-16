import type { InertiaRequestShape } from './service-types.ts';

const firstHeader = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const [first] = value.split(',');
  return first === undefined ? undefined : first.trim();
};

const fullUrl = (req: InertiaRequestShape): string => {
  const proto = firstHeader(req.header('x-forwarded-proto')) ?? 'http';
  const host = firstHeader(req.header('host')) ?? 'localhost';
  return new URL(req.originalUrl, `${proto}://${host}`).toString();
};

export { firstHeader, fullUrl };
