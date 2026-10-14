import type { Buffer } from 'node:buffer';

import type { NestRequest } from '#adapter/core/request/request';

/** The options Nest hands the parser middleware. */
interface BodyParserOptions {
  readonly limit?: number | string;
}

/** The hook Nest's built-in HTTP security features register. */
type SecurityHook = (
  request: NestRequest,
  response: {
    setHeader: (name: string, value: string) => unknown;
    removeHeader: (name: string) => unknown;
  },
) => Error | undefined;

/** A payload as the pipeline reads it. */
interface ParsedBody {
  body: unknown;
  files: Record<string, unknown> | undefined;
  rawBody: Buffer | undefined;
}

/** The options a request body is read with. */
interface BodyOptions {
  readonly bodyLimit: number | undefined;
  readonly rawBody: boolean;
  /** Whether a multipart body is left for the upload island. */
  readonly skipMultipart?: boolean;
}

/** A multipart payload, split into its two halves. */
interface FormParts {
  readonly fields: Record<string, unknown>;
  readonly files: Record<string, unknown>;
}

export type {
  BodyOptions,
  BodyParserOptions,
  FormParts,
  ParsedBody,
  SecurityHook,
};
