import 'reflect-metadata';

import { readFile, readdir } from 'node:fs/promises';

import { afterAll, describe, expect, test } from 'bun:test';

import {
  ABORT_DEADLINE,
  abortDirectory,
  abortingBody,
  asRecord,
  AsyncUploadModule,
  BAD_REQUEST,
  cleanup,
  CREATED,
  DISK_CONTENT,
  filePart,
  FORBIDDEN_FIELD,
  NESTED_FORBIDDEN,
  OVER_LIMIT,
  POLLUTED,
  textFiles,
  TOO_LARGE,
  UploadModule,
  upload,
  withDeadline,
} from './multipart.support.ts';
import { request, startProbe } from './probe.ts';

afterAll(cleanup);

describe('one file', () => {
  test('FileInterceptor stores the file and the text fields', async () => {
    const form = filePart('hello');
    form.append('title', 'a post');

    const result = await upload('/single', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({
      body: { title: 'a post' },
      file: {
        buffered: true,
        mimetype: 'text/plain',
        originalname: 'a.txt',
        size: 'hello'.length,
      },
    });
  });

  test('a request with no file leaves @UploadedFile() empty', async () => {
    const form = new FormData();
    form.append('title', 'a post');

    const result = await upload('/single', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ body: { title: 'a post' } });
  });
});

describe('FilesInterceptor', () => {
  test('stores every file, in order', async () => {
    const result = await upload(
      '/many',
      textFiles('files', ['one', 'two']),
    );

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({
      files: [
        {
          buffered: true,
          mimetype: 'text/plain',
          originalname: '0.txt',
          size: 3,
        },
        {
          buffered: true,
          mimetype: 'text/plain',
          originalname: '1.txt',
          size: 3,
        },
      ],
    });
  });
});

describe('FileFieldsInterceptor', () => {
  test('groups files by field', async () => {
    const form = new FormData();
    form.append(
      'avatar',
      new Blob(['me'], { type: 'image/png' }),
      'me.png',
    );
    form.append(
      'gallery',
      new Blob(['x'], { type: 'text/plain' }),
      'x.txt',
    );
    form.append(
      'gallery',
      new Blob(['y'], { type: 'text/plain' }),
      'y.txt',
    );

    const result = await upload('/fields', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({
      avatar: {
        buffered: true,
        mimetype: 'image/png',
        originalname: 'me.png',
        size: 2,
      },
      gallery: 2,
    });
  });
});

describe('AnyFilesInterceptor', () => {
  test('stores files from any field', async () => {
    const form = new FormData();
    form.append(
      'one',
      new Blob(['a'], { type: 'text/plain' }),
      'a.txt',
    );
    form.append(
      'two',
      new Blob(['b'], { type: 'text/plain' }),
      'b.txt',
    );

    const result = await upload('/any', form);

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({
      count: 2,
      names: ['one', 'two'],
    });
  });
});

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
    const result = await upload(
      '/disk',
      filePart(DISK_CONTENT),
    );
    const { path: target } = asRecord(result.body);

    expect(result.status).toBe(CREATED);
    expect(typeof target).toBe('string');
    if (typeof target !== 'string') {
      throw new TypeError('disk storage reported no path');
    }
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

      const outcome = await withDeadline(
        request(probe, '/aborted', init),
        ABORT_DEADLINE,
      );

      if (outcome === 'hung') {
        throw new Error('the aborted upload never answered');
      }
      expect(outcome.status).toBeGreaterThanOrEqual(
        BAD_REQUEST,
      );
      expect(await readdir(abortDirectory)).toEqual([]);
    } finally {
      await probe.close();
    }
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
    const result = await upload(
      '/single',
      filePart(OVER_LIMIT),
    );

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
          'content-type':
            'multipart/form-data; boundary=----absent',
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
