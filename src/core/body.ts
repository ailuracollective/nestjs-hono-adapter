import { Buffer } from 'node:buffer';

import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

import type { NestContext } from './context.ts';
import { parseQuery } from './query.ts';

/** Methods that never carry a payload. */
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/** The media types that carry a JSON document. */
const JSON_TYPE = /^application\/(?:.+\+)?json$/u;

/** How a limit may be written, in the notation Nest accepts. */
const LIMIT =
  /^\s*(?<amount>\d+(?:\.\d+)?)\s*(?<unit>b|kb|mb|gb|tb|pb)?\s*$/iu;

/** The size a kibibyte stands for, which every unit is built on. */
const BYTES_PER_KIB = 1024;

const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const BYTES_PER_GIB = BYTES_PER_MIB * BYTES_PER_KIB;
const BYTES_PER_TIB = BYTES_PER_GIB * BYTES_PER_KIB;
const BYTES_PER_PIB = BYTES_PER_TIB * BYTES_PER_KIB;

/** The size each unit of a limit stands for. */
const UNITS = new Map<string, number>([
  ['b', 1],
  ['gb', BYTES_PER_GIB],
  ['kb', BYTES_PER_KIB],
  ['mb', BYTES_PER_MIB],
  ['pb', BYTES_PER_PIB],
  ['tb', BYTES_PER_TIB],
]);

/**
 * A payload as the pipeline reads it: the parsed value, the
 * uploaded files when the request was multipart, and the bytes
 * when the application asked to keep them.
 */
interface ParsedBody {
  body: unknown;
  files: Record<string, unknown> | undefined;
  rawBody: Buffer | undefined;
}

interface BodyOptions {
  readonly bodyLimit: number | undefined;
  readonly rawBody: boolean;
}

/** A multipart payload, split into its two halves. */
interface FormParts {
  readonly fields: Record<string, unknown>;
  readonly files: Record<string, unknown>;
}

/**
 * Reads a size the way Nest's own parsers do, so a limit such
 * as `100kb` means the same thing here as it does on Express.
 */
function toByteLimit(limit: number | string): number {
  if (typeof limit === 'number') {
    return limit;
  }
  const match = LIMIT.exec(limit);
  if (match === null) {
    throw new TypeError(
      `The body limit "${limit}" is not a size such as ` +
        '"100kb" or "1mb".',
    );
  }
  const { amount, unit } = match.groups ?? {};
  const bytes = Number(amount ?? '');
  const suffix = (unit ?? 'b').toLowerCase();
  return Math.floor(bytes * (UNITS.get(suffix) ?? 1));
}

function mediaType(context: NestContext): string {
  const header = context.req.header('content-type') ?? '';
  return (header.split(';')[0] ?? '').trim().toLowerCase();
}

function assertWithinLength(
  context: NestContext,
  limit: number | undefined,
): void {
  if (limit === undefined) {
    return;
  }
  const declared = context.req.header('content-length');
  if (declared === undefined) {
    return;
  }
  const length = Number(declared);
  if (Number.isFinite(length) && length > limit) {
    throw new PayloadTooLargeException();
  }
}

function assertWithinSize(
  size: number,
  limit: number | undefined,
): void {
  if (limit !== undefined && size > limit) {
    throw new PayloadTooLargeException();
  }
}

async function readBytes(
  context: NestContext,
  limit: number | undefined,
): Promise<Uint8Array> {
  const bytes = new Uint8Array(await context.req.arrayBuffer());
  assertWithinSize(bytes.byteLength, limit);
  return bytes;
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function parseJson(bytes: Uint8Array): unknown {
  const text = textOf(bytes).trim();
  if (text === '') {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestException('Malformed request body');
  }
}

function parseBytes(bytes: Uint8Array, type: string): unknown {
  if (JSON_TYPE.test(type)) {
    return parseJson(bytes);
  }
  if (type === 'application/x-www-form-urlencoded') {
    return parseQuery(textOf(bytes));
  }
  if (type.startsWith('text/')) {
    return textOf(bytes);
  }
  if (bytes.byteLength === 0) {
    return undefined;
  }
  return Buffer.from(bytes);
}

async function readForm(
  context: NestContext,
): Promise<Record<string, string | File>> {
  try {
    return await context.req.parseBody();
  } catch {
    throw new BadRequestException('Malformed request body');
  }
}

function splitFields(
  form: Record<string, string | File>,
): FormParts {
  const fields: Record<string, unknown> = {};
  const files: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(form)) {
    if (typeof value === 'string') {
      fields[name] = value;
    } else {
      files[name] = value;
    }
  }
  return { fields, files };
}

/**
 * Reads a multipart request into the two halves a controller
 * expects: the text fields in the body, the uploads in `files`.
 * The bytes are never buffered, so `rawBody` stays empty.
 */
async function readMultipart(
  context: NestContext,
): Promise<ParsedBody> {
  const form = await readForm(context);
  const parts = splitFields(form);
  const parsed: ParsedBody = {
    body: parts.fields,
    files: undefined,
    rawBody: undefined,
  };
  if (Object.keys(parts.files).length > 0) {
    parsed.files = parts.files;
  }
  return parsed;
}

function emptyBody(): ParsedBody {
  return {
    body: undefined,
    files: undefined,
    rawBody: undefined,
  };
}

async function readPayload(
  context: NestContext,
  type: string,
  options: BodyOptions,
): Promise<ParsedBody> {
  const bytes = await readBytes(context, options.bodyLimit);
  const parsed: ParsedBody = {
    body: parseBytes(bytes, type),
    files: undefined,
    rawBody: undefined,
  };
  if (options.rawBody) {
    parsed.rawBody = Buffer.from(bytes);
  }
  return parsed;
}

/**
 * Reads the payload for the pipeline.
 *
 * On Express and Fastify Nest installs parser middleware that
 * fills `req.body` before the pipeline runs. Hono parses on
 * demand, so the adapter reads the body here and hands it over
 * in the same place. A payload that does not match its content
 * type is refused with the exception Nest raises for a failed
 * parse, so filters and logging see it like any other failure.
 */
function readBody(
  context: NestContext,
  options: BodyOptions,
): Promise<ParsedBody> {
  if (BODYLESS_METHODS.has(context.req.method)) {
    return Promise.resolve(emptyBody());
  }
  const type = mediaType(context);
  assertWithinLength(context, options.bodyLimit);
  if (type.startsWith('multipart/form-data')) {
    return readMultipart(context);
  }
  return readPayload(context, type, options);
}

export { readBody, toByteLimit };
export type { ParsedBody };
