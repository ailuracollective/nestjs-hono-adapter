import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import {
  BAD_REQUEST,
  CREATED,
  OVER_LIMIT,
  TOO_LARGE,
} from '#multipart-test/multipart.support/constants';
import { filePart } from '#multipart-test/multipart.support/parts';
import { AsyncUploadModule, UploadModule, upload } from '#multipart-test/multipart.support/uploads';
import { request, startProbe } from '#test/probe';

describe('module options from registerAsync', () => {
  test('a limit the route never named is enforced', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: AsyncUploadModule,
    });
    try {
      const result = await request(probe, '/single', {
        body: filePart(OVER_LIMIT),
        method: 'POST',
      });

      expect(result.status).toBe(TOO_LARGE);
    } finally {
      await probe.close();
    }
  });

  test('the same upload passes when no module names a limit', async () => {
    const result = await upload('/single', filePart(OVER_LIMIT));

    expect(result.status).toBe(CREATED);
  });
});

describe('a malformed multipart body', () => {
  test('a boundary the body never names is refused with 400', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: UploadModule,
    });
    try {
      const result = await request(probe, '/single', {
        body: 'a body that never names the boundary it declared',
        headers: {
          'content-type': 'multipart/form-data; boundary=----absent',
        },
        method: 'POST',
      });

      expect(result.status).toBe(BAD_REQUEST);
      expect(result.body).toMatchObject({
        statusCode: BAD_REQUEST,
      });
    } finally {
      await probe.close();
    }
  });
});

describe('a content type that declares no boundary', () => {
  test('is refused with 400, not 500', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: UploadModule,
    });
    try {
      const result = await request(probe, '/single', {
        body: 'a body whose content type declares no boundary',
        headers: { 'content-type': 'multipart/form-data' },
        method: 'POST',
      });

      expect(result.status).toBe(BAD_REQUEST);
      expect(result.body).toMatchObject({
        message: 'Multipart: Boundary not found',
        statusCode: BAD_REQUEST,
      });
    } finally {
      await probe.close();
    }
  });
});
