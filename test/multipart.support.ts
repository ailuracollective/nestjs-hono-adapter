import 'reflect-metadata';

import { rm } from 'node:fs/promises';
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

import type {
  MultipartOptions,
  UploadedMultipartFile,
} from '../src/multipart/index.ts';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
  MultipartModule,
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

/** The field name that would reach the prototype chain. */
const FORBIDDEN_FIELD = '__proto__';

/** What a polluted object would answer with, if it were one. */
const POLLUTED = 'polluted';

/** A nested name whose second step reaches the same chain. */
const NESTED_FORBIDDEN = 'nested[__proto__]';

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

/**
 * Removes the directories the disk cases write, so a run leaves
 * nothing behind. The test files register it with `afterAll`.
 */
async function cleanup(): Promise<void> {
  await Promise.all([
    rm(abortDirectory, { force: true, recursive: true }),
    rm(directory, { force: true, recursive: true }),
  ]);
}

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

/**
 * Accepts a text part and skips anything else. Multer's filter
 * is callback-shaped, so the answer travels through the
 * callback it is handed rather than a return value.
 */
/* oxlint-disable promise/prefer-await-to-callbacks, unicorn/no-null -- multer's fileFilter answers through the callback it is handed and spells "no error" as null, so a case that drives it cannot be written without either. */
const textOnly: NonNullable<MultipartOptions['fileFilter']> = (
  _request,
  file,
  callback,
) => {
  callback(null, file.mimetype === 'text/plain');
};
/* oxlint-enable promise/prefer-await-to-callbacks, unicorn/no-null */

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

  @Post('filtered')
  @UseInterceptors(
    FileInterceptor('file', { fileFilter: textOnly }),
  )
  public filtered(
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ): unknown {
    return {
      file: summarize(file),
      hasFile: file !== undefined,
    };
  }
}

@Module({ controllers: [UploadController] })
class UploadModule {}

/**
 * The same controller over a module whose limits arrive from
 * `registerAsync` rather than from a route's own argument, so a
 * case can tell the two sources apart.
 */
@Module({
  controllers: [UploadController],
  imports: [
    MultipartModule.registerAsync({
      useFactory: () => ({ limits: { fileSize: LIMIT } }),
    }),
  ],
})
class AsyncUploadModule {}

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

export {
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
};
