import type { Buffer } from 'node:buffer';

import type { NestRequest } from '#adapter/core/request/request';

interface BodyParserOptions {
  readonly limit?: number | string;
}

type SecurityHook = (
  request: NestRequest,
  response: {
    setHeader: (name: string, value: string) => unknown;
    removeHeader: (name: string) => unknown;
  },
) => Error | undefined;

interface ParsedBody {
  body: unknown;
  files: Record<string, unknown> | undefined;
  rawBody: Buffer | undefined;
}

interface BodyOptions {
  readonly bodyLimit: number | undefined;
  readonly rawBody: boolean;
  readonly skipMultipart?: boolean;
}

interface FormParts {
  readonly fields: Record<string, unknown>;
  readonly files: Record<string, unknown>;
}

export type { BodyOptions, BodyParserOptions, FormParts, ParsedBody, SecurityHook };
