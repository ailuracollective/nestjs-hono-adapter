import type { NestRequest } from '#adapter/core/request/request';

type AllowedOrigins = boolean | string | RegExp | readonly (string | RegExp)[];

type OriginCallback = (requestOrigin: string | undefined, answer: OriginAnswer) => void;

type OriginAnswer = (error?: Error | null, origin?: AllowedOrigins) => void;

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

type CorsAnswer = (error: Error | null, options: CorsOptions) => void;

type CorsOptionsDelegate = (request: NestRequest, answer: CorsAnswer) => void;

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
