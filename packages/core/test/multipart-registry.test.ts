import { expect, test } from 'bun:test';

import {
  declareMultipart,
  parsesMultipart,
} from '#adapter/core/multipart';
import { ServerAdapter } from '#adapter/index';

test('declareMultipart() marks the newest adapter', () => {
  const adapter = new ServerAdapter();
  expect(parsesMultipart(adapter)).toBe(false);
  declareMultipart();
  expect(parsesMultipart(adapter)).toBe(true);
});

test('declareMultipart(adapter) marks only the one it is given', () => {
  const adapter = new ServerAdapter();
  const other = new ServerAdapter();
  declareMultipart(adapter);
  expect(parsesMultipart(adapter)).toBe(true);
  expect(parsesMultipart(other)).toBe(false);
});
