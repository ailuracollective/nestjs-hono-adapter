import type { NestContext } from '@ailura/nestjs-hono-adapter';

const CONFLICT = 409;
const ABSOLUTE = /^[a-z][a-z0-9+.-]*:\/\//iu;

const isInertia = (context: NestContext): boolean => context.req.header('X-Inertia') !== undefined;

const isPrefetch = (context: NestContext): boolean => {
  const purpose = context.req.header('Purpose');
  if (purpose === undefined) return false;
  return purpose.toLowerCase() === 'prefetch';
};

const absoluteUrl = (context: NestContext, target: string): string =>
  ABSOLUTE.test(target) ? target : new URL(target, context.req.url).toString();

const varyOn = (context: NestContext): void => {
  const current = context.res.headers.get('vary');
  if (current === null) {
    context.header('Vary', 'X-Inertia');
    return;
  }
  if (current.toLowerCase().includes('x-inertia')) return;
  context.header('Vary', 'X-Inertia', { append: true });
};

const fragmentResponse = (context: NestContext, location: string): Response => {
  varyOn(context);
  context.header('X-Inertia-Redirect', location);
  context.res = new Response(undefined, {
    headers: context.res.headers,
    status: CONFLICT,
  });
  return context.res;
};

export { absoluteUrl, fragmentResponse, isInertia, isPrefetch, varyOn };
