import { expect } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { jsonRequest } from '#adapter-test/support/index';
import { request } from '#test/probe';
import type { Probe } from '#test/probe';
import { BODY_LIMIT } from '#adapter-test/bodies/support';
import type { BodyParserOptions } from '#adapter/index';

/** Options as a caller writing plain JavaScript passes them. */
type CallerOptions = BodyParserOptions &
  Record<string, unknown>;

/** Asserts the parser kept the adapter's body limit. */
const assertLimit = async (probe: Probe): Promise<void> => {
  const oversized = await request(
    probe,
    '/echo',
    jsonRequest({ text: 'x'.repeat(BODY_LIMIT) }),
  );
  expect(oversized.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
};

/** Asserts the raw-body route reads back the payload. */
const assertRaw = async (
  probe: Probe,
  expected: string,
): Promise<void> => {
  const raw = await request(
    probe,
    '/raw',
    jsonRequest({ name: 'note' }),
  );
  expect(raw.status).toBe(HttpStatus.CREATED);
  expect(raw.body).toStrictEqual({ raw: expected });
};

export { assertLimit, assertRaw };
export type { CallerOptions };
