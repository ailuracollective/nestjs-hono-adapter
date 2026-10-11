import 'reflect-metadata';

import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  Body,
  Controller,
  Module,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { afterAll, describe, expect, test } from 'bun:test';

import type { UploadedMultipartFile } from '../src/multipart/index.ts';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
  NoFilesInterceptor,
  diskStorage,
} from '../src/multipart/index.ts';
import { request, startProbe } from './probe.ts';

/** The statuses and payloads the cases below use. */
const CREATED = 201;
const BAD_REQUEST = 400;
const TOO_LARGE = 413;
const LIMIT = 4;
const OVER_LIMIT = 'too long';
const DISK_CONTENT = 'on disk';
const MAX_FILES = 3;
const GALLERY = 2;

/** Where disk storage writes, created by the engine itself. */
const directory = path.join(
  tmpdir(),
  'hono-upload-adapter-test',
);

/** Where an aborted upload writes, so its leftovers are checked. */
const abortDirectory = path.join(
  tmpdir(),
  'hono-upload-adapter-abort-test',
);

/** How long an aborted upload may take before it counts as hung. */
const ABORT_DEADLINE = 2000;

afterAll(() =>
  Promise.all([
    rm(abortDirectory, { force: true, recursive: true }),
    rm(directory, { force: true, recursive: true }),
  ]),
);

/** What one upload is reported as, so a case can read it. */
interface FileSummary {
  originalname: string;
  mimetype: string;
  size: number;
  buffered: boolean;
}

function summarize(
  file: UploadedMultipartFile | undefined,
): FileSummary | undefined {
  if (file === undefined) {
    return undefined;
  }
  return {
    buffered: file.buffer !== undefined,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  };
}

/** What one part is named and typed as, when not the default. */
interface PartOptions {
  name?: string;
  filename?: string;
  type?: string;
}

/** A form holding one file part. */
function filePart(
  content: string,
  options: PartOptions = {},
): FormData {
  const form = new FormData();
  const {
    filename = 'a.txt',
    name = 'file',
    type = 'text/plain',
  } = options;
  form.append(name, new Blob([content], { type }), filename);
  return form;
}

/** A form holding numbered text files under one field. */
function textFiles(
  field: string,
  contents: string[],
): FormData {
  const form = new FormData();
  for (const [index, content] of contents.entries()) {
    const name = `${index}.txt`;
    form.append(
      field,
      new Blob([content], { type: 'text/plain' }),
      name,
    );
  }
  return form;
}

@Controller()
class UploadController {
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  public single(
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body() body: Record<string, unknown>,
  ): unknown {
    return { body, file: summarize(file) };
  }

  @Post('many')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES))
  public many(
    @UploadedFiles() files: UploadedMultipartFile[],
  ): unknown {
    return { files: files.map((file) => summarize(file)) };
  }

  @Post('fields')
  @UseInterceptors(
    FileFieldsInterceptor([
      { maxCount: 1, name: 'avatar' },
      { maxCount: GALLERY, name: 'gallery' },
    ]),
  )
  public fields(
    @UploadedFiles() files: Record<
      string,
      UploadedMultipartFile[]
    >,
  ): unknown {
    const { avatar, gallery } = files;
    let first: UploadedMultipartFile | undefined = undefined;
    if (avatar !== undefined) {
      [first] = avatar;
    }
    let count = 0;
    if (gallery !== undefined) {
      count = gallery.length;
    }
    return { avatar: summarize(first), gallery: count };
  }

  @Post('any')
  @UseInterceptors(AnyFilesInterceptor())
  public any(
    @UploadedFiles() files: UploadedMultipartFile[],
  ): unknown {
    return {
      count: files.length,
      names: files.map((file) => file.fieldname),
    };
  }

  @Post('none')
  @UseInterceptors(NoFilesInterceptor())
  public none(@Body() body: Record<string, unknown>): unknown {
    return { body };
  }

  @Post('limited')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LIMIT } }),
  )
  public limited(
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ): unknown {
    if (file === undefined) {
      return {};
    }
    const { size } = file;
    return { size };
  }

  @Post('disk')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: directory }),
    }),
  )
  public disk(
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ): unknown {
    if (file === undefined) {
      return { hasBuffer: false, size: 0 };
    }
    const { buffer, filename, path: target, size } = file;
    return {
      filename,
      hasBuffer: buffer !== undefined,
      path: target,
      size,
    };
  }

  @Post('aborted')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: abortDirectory }),
    }),
  )
  public aborted(
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ): unknown {
    return { file: summarize(file) };
  }
}

@Module({ controllers: [UploadController] })
class UploadModule {}

/** Sends one form to a route of a fresh application. */
async function upload(
  route: string,
  form: FormData,
): Promise<Awaited<ReturnType<typeof request>>> {
  const probe = await startProbe({
    mode: 'in-process',
    module: UploadModule,
  });
  try {
    return await request(probe, route, {
      body: form,
      method: 'POST',
    });
  } finally {
    await probe.close();
  }
}

/**
 * Answers with `promise`, or with `'hung'` when it has not
 * settled within `deadline`, so a request that never answers
 * fails the case instead of stalling the suite.
 */
function withDeadline<Value>(
  promise: Promise<Value>,
  deadline: number,
): Promise<Value | 'hung'> {
  return Promise.race([
    promise,
    delay(deadline, 'hung' as const),
  ]);
}

/**
 * A multipart body that opens one file part and then errors,
 * which is what a client aborting mid-upload leaves behind: the
 * first pull delivers the part headers and some content, and
 * the next one errors the body.
 */
function abortingBody(
  boundary: string,
): ReadableStream<Uint8Array> {
  const head =
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="abort.txt"\r\n' +
    'Content-Type: text/plain\r\n\r\n';
  return new ReadableStream<Uint8Array>({
    pull(controller): void {
      controller.error(new Error('client aborted'));
    },
    start(controller): void {
      controller.enqueue(
        new TextEncoder().encode(`${head}partial`),
      );
    },
  });
}

/**
 * A value as a record, for reading a body whose shape is
 * checked.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return Object.fromEntries(Object.entries(value));
}

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
