import 'reflect-metadata';

import { describe, expect, test } from 'bun:test';

import { CREATED } from '#multipart-test/multipart.support/constants';
import {
  filePart,
  textFiles,
} from '#multipart-test/multipart.support/parts';
import { upload } from '#multipart-test/multipart.support/uploads';

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
