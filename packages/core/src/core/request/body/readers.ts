import { Buffer } from 'node:buffer';

import { BadRequestException } from '@nestjs/common';

import type { NestContext } from '#adapter/core/context';
import {
  charsetOf,
  textOf,
} from '#adapter/core/request/body-encoding';
import { parseQuery } from '#adapter/core/request/query/index';
import {
  JSON_TYPE,
  assertWithinSize,
  bounded,
} from './guards.ts';
import type {
  BodyOptions,
  FormParts,
  ParsedBody,
} from './types.ts';

/** Whether the request declares its payload length up front. */
const declaresLength = (context: NestContext): boolean => {
  const declared = context.req.header('content-length');
  return (
    declared !== undefined && Number.isFinite(Number(declared))
  );
};

/** Reads an unconsumed payload through the ceiling. */
const readBytes = async (
  context: NestContext,
  limit: number | undefined,
): Promise<Uint8Array> => {
  if (context.req.raw.bodyUsed || declaresLength(context)) {
    const bytes = new Uint8Array(
      await context.req.arrayBuffer(),
    );
    assertWithinSize(bytes.byteLength, limit);
    return bytes;
  }
  const { body } = context.req.raw;
  if (body === null) {
    return new Uint8Array();
  }
  const answer = new Response(bounded(body, limit));
  return new Uint8Array(await answer.arrayBuffer());
};

/** Parses a JSON payload. */
const parseJson = (
  bytes: Uint8Array,
  charset: string,
): unknown => {
  const text = textOf(bytes, charset).trim();
  if (text === '') {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestException('Malformed request body');
  }
};

/** Parses a payload by its media type. */
const parseBytes = (
  bytes: Uint8Array,
  type: string,
  charset: string,
): unknown => {
  if (JSON_TYPE.test(type)) {
    return parseJson(bytes, charset);
  }
  if (type === 'application/x-www-form-urlencoded') {
    return parseQuery(textOf(bytes, charset));
  }
  if (type.startsWith('text/')) {
    return textOf(bytes, charset);
  }
  if (bytes.byteLength === 0) {
    return undefined;
  }
  return Buffer.from(bytes);
};

/** Reads a multipart form. */
const readForm = async (
  context: NestContext,
): Promise<Record<string, string | File>> => {
  try {
    return await context.req.parseBody();
  } catch {
    throw new BadRequestException('Malformed request body');
  }
};

/** Splits a form into its text fields and its uploads. */
const splitFields = (
  form: Record<string, string | File>,
): FormParts => {
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
};

/** Reads a multipart request into fields and files. */
const readMultipart = async (
  context: NestContext,
): Promise<ParsedBody> => {
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
};

/** The payload of a request that carries none. */
const emptyBody = (): ParsedBody => ({
  body: undefined,
  files: undefined,
  rawBody: undefined,
});

/** Reads and parses a non-multipart payload. */
const readPayload = async (
  context: NestContext,
  type: string,
  options: BodyOptions,
): Promise<ParsedBody> => {
  const bytes = await readBytes(context, options.bodyLimit);
  const parsed: ParsedBody = {
    body: parseBytes(bytes, type, charsetOf(context)),
    files: undefined,
    rawBody: undefined,
  };
  if (options.rawBody) {
    parsed.rawBody = Buffer.from(bytes);
  }
  return parsed;
};

export { emptyBody, readMultipart, readPayload };
