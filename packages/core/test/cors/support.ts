import { Hono } from 'hono';

import type { NestEnv } from '#adapter/core/context';
import { corsBridge } from '#adapter/features/cors/index';
import type {
  CorsConfig,
  CorsOptions,
} from '#adapter/features/cors/index';

/** The origin the configuration allows. */
const ALLOWED = 'https://child.example.com';
/** The origin the configuration refuses. */
const FOREIGN = 'https://somewhere.else.example';

/** The status a request with no origin is answered with. */
const OK = 200;

/** The status a preflight is answered with. */
const NO_CONTENT = 204;

/** The status a request whose handling threw gets. */
const SERVER_ERROR = 500;

/** Builds a Hono application that bridges CORS. */
const bridged = (options: CorsConfig): Hono<NestEnv> => {
  const hono = new Hono<NestEnv>();

  hono.use(
    '*',
    corsBridge(() => options, false),
  );
  hono.onError((_error, context) =>
    context.text('failed', SERVER_ERROR),
  );
  hono.get('/', (context) => context.text('ok'));
  hono.options('/', (context) => context.text('reached'));

  return hono;
};

/** The CORS options a deployment uses for its own clients. */
const CROSS_SITE: CorsOptions = {
  credentials: true,
  origin: [ALLOWED],
};

/** Whether a response named an origin at all. */
const namedOrigin = (response: Response): boolean =>
  response.headers.get('access-control-allow-origin') !== null;

/** The text of a header, empty when it is absent. */
const headerText = (value: string | null): string => {
  if (value === null) {
    return '';
  }

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
