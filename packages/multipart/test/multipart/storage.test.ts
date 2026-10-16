import 'reflect-metadata';

import { readFile, readdir } from 'node:fs/promises';

import { afterAll, describe, expect, test } from 'bun:test';

import {
  ABORT_DEADLINE,
  abortDirectory,
  BAD_REQUEST,
  CREATED,
  DISK_CONTENT,
} from '#multipart-test/multipart.support/constants';
import { filePart } from '#multipart-test/multipart.support/parts';
import {
  abortingBody,
  asRecord,
  cleanup,
  withDeadline,
} from '#multipart-test/multipart.support/requests';
import { UploadModule, upload } from '#multipart-test/multipart.support/uploads';
import { request, startProbe } from '#test/probe';

afterAll(cleanup);

describe('over a connection', () => {
  test('an upload reaches the route through the server', async () => {
    const probe = await startProbe({ module: UploadModule });
    try {
      const result = await request(probe, '/single', {
        body: filePart('live'),
        method: 'POST',
      });

      expect(result.status).toBe(CREATED);
      expect(result.body).toEqual({
        body: {},
        file: {
          buffered: true,
          mimetype: 'text/plain',
          originalname: 'a.txt',
          size: 'live'.length,
        },
      });
    } finally {
      await probe.close();
    }
  });
});

describe('disk storage', () => {
  test('the file is written and its path is reported', async () => {
    const result = await upload('/disk', filePart(DISK_CONTENT));
    const { path: target } = asRecord(result.body);

    expect(result.status).toBe(CREATED);
    expect(typeof target).toBe('string');
    if (typeof target !== 'string') throw new TypeError('disk storage reported no path');
    expect(await readFile(target, 'utf8')).toBe(DISK_CONTENT);
  });
});

describe('an aborted upload', () => {
  test('the request settles and the partial file is removed', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: UploadModule,
    });
    try {
      const boundary = 'abort-boundary';
      const init: RequestInit & { duplex?: string } = {
        body: abortingBody(boundary),
        duplex: 'half',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        method: 'POST',
      };

      const outcome = await withDeadline(request(probe, '/aborted', init), ABORT_DEADLINE);

      if (outcome === 'hung') throw new Error('the aborted upload never answered');
      expect(outcome.status).toBeGreaterThanOrEqual(BAD_REQUEST);
      expect(await readdir(abortDirectory)).toEqual([]);
    } finally {
      await probe.close();
    }
  });
});
