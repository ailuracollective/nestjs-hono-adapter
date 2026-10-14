import type { NestRequest } from '#adapter/core/request/request';

/** The origins a deployment may allow. */
type AllowedOrigins =
  | boolean
  | string
  | RegExp
  | readonly (string | RegExp)[];

/** The callback that decides an origin for each request. */
type OriginCallback = (
  requestOrigin: string | undefined,
  answer: OriginAnswer,
) => void;

/** The answer an origin callback reports back. */
type OriginAnswer = (
  error?: Error | null,
  origin?: AllowedOrigins,
) => void;

/** The CORS options the adapter honours. */
interface CorsOptions {
  readonly allowedHeaders?: string | readonly string[];
  readonly credentials?: boolean;
  readonly exposedHeaders?: string | readonly string[];
  readonly maxAge?: number;
  readonly methods?: string | readonly string[];
  readonly optionsSuccessStatus?: number;
  readonly origin?: AllowedOrigins | OriginCallback;
  readonly preflightContinue?: boolean;
}

/** The answer a CORS options delegate reports back. */
type CorsAnswer = (
  error: Error | null,
  options: CorsOptions,
) => void;

/** The delegate that decides CORS options per request. */
type CorsOptionsDelegate = (
  request: NestRequest,
  answer: CorsAnswer,
) => void;

/** What a deployment configured CORS with. */
type CorsConfig = CorsOptions | CorsOptionsDelegate;

export type {
  AllowedOrigins,
  CorsAnswer,
  CorsConfig,
  CorsOptions,
  CorsOptionsDelegate,
  OriginAnswer,
  OriginCallback,
};
