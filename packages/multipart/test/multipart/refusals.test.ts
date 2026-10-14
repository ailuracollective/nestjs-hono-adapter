import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import {
  BAD_REQUEST,
  CREATED,
  FORBIDDEN_FIELD,
  NESTED_FORBIDDEN,
  OVER_LIMIT,
  POLLUTED,
  TOO_LARGE,
} from '#multipart-test/multipart.support/constants';
import { filePart } from '#multipart-test/multipart.support/parts';
import { upload } from '#multipart-test/multipart.support/uploads';

describe('no files', () => {
  test('a file is refused, naming the field', async () => {
    const refused = await upload('/none', filePart('x'));

    expect(refused.status).toBe(BAD_REQUEST);
    expect(refused.body).toEqual({
      error: 'Bad Request',
      message: 'Unexpected file field - file',
      statusCode: BAD_REQUEST,
    });
  });

  test('a form of text fields is accepted', async () => {
    const form = new FormData();
    form.append('field', 'value');

    const result = await upload('/none', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ body: { field: 'value' } });
  });
});

describe('limits', () => {
  test('a file over the limit is refused with 413', async () => {
    const result = await upload(
      '/limited',
      filePart(OVER_LIMIT),
    );

    expect(result.status).toBe(TOO_LARGE);
    expect(result.body).toMatchObject({
      statusCode: TOO_LARGE,
    });
  });

  test('a file within the limit is stored', async () => {
    const result = await upload('/limited', filePart('ok'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ size: 2 });
  });
});

describe('a file filter', () => {
  test('a refused file is skipped and the request still answers', async () => {
    const form = filePart('binary', { type: 'image/png' });

    const result = await upload('/filtered', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ hasFile: false });
  });

  test('an accepted file is stored', async () => {
    const result = await upload('/filtered', filePart('text'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toMatchObject({
      file: { mimetype: 'text/plain', size: 'text'.length },
      hasFile: true,
    });
  });
});

describe('a field name that would reach the prototype', () => {
  test('__proto__ is refused with 400 and pollutes nothing', async () => {
    const form = new FormData();
    form.append(FORBIDDEN_FIELD, POLLUTED);

    const result = await upload('/single', form);

    expect(result.status).toBe(BAD_REQUEST);
    expect(result.body).toMatchObject({
      message: `Invalid field name - ${FORBIDDEN_FIELD}`,
      statusCode: BAD_REQUEST,
    });
    expect(
      ({} as Record<string, unknown>)[POLLUTED],
    ).toBeUndefined();
  });

  test('a nested step onto the same chain is refused too', async () => {
    const form = new FormData();
    form.append(NESTED_FORBIDDEN, POLLUTED);

    const result = await upload('/single', form);

    expect(result.status).toBe(BAD_REQUEST);
    expect(
      ({} as Record<string, unknown>)[POLLUTED],
    ).toBeUndefined();
  });
});
