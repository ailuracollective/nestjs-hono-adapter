import { Hono } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { corsBridge } from '#adapter/features/cors/index';
import type { CorsConfig, CorsOptions } from '#adapter/features/cors/index';

const ALLOWED = 'https://child.example.com';
const FOREIGN = 'https://somewhere.else.example';

const OK = 200;

const NO_CONTENT = 204;

const SERVER_ERROR = 500;

const bridged = (options: CorsConfig): Hono<NestEnv> => {
  const hono = new Hono<NestEnv>();

  hono.use(
    '*',
    corsBridge(
      () => options,
      () => false,
    ),
  );
  hono.onError((_error, context) => context.text('failed', SERVER_ERROR));
  hono.get('/', (context) => context.text('ok'));
  hono.options('/', (context) => context.text('reached'));

  return hono;
};

const CROSS_SITE: CorsOptions = {
  credentials: true,
  origin: [ALLOWED],
};

const namedOrigin = (response: Response): boolean =>
  response.headers.get('access-control-allow-origin') !== null;

const headerText = (value: string | null): string => {
  if (value === null) return '';

  return value;
};

export {
  ALLOWED,
  CROSS_SITE,
  FOREIGN,
  NO_CONTENT,
  OK,
  SERVER_ERROR,
  bridged,
  headerText,
  namedOrigin,
};
