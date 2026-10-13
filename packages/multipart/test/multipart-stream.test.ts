/**
 * The streaming upload seam: `FileStreamInterceptor` hands the
 * file over unread and discards whatever the handler leaves.
 *
 * The cases below pin the two halves apart. The first half is
 * what the handler gets: a live stream, the fields that came
 * before it, and nothing that came after. The second is what
 * the client gets: a request that is read to its end even when
 * the handler never looks at the upload, because an unread body
 * is what a client that is still uploading trips over.
 */

import 'reflect-metadata';

import { text } from 'node:stream/consumers';

import { describe, expect, test } from 'bun:test';

import {
  Body,
  Controller,
  Module,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import type { MultipartFileStream } from '../src/index.ts';
import { FileStreamInterceptor } from '../src/index.ts';
import {
  ABORT_DEADLINE,
  abortingBody,
  asRecord,
  filePart,
  withDeadline,
} from './multipart.support.ts';
import { request, startProbe } from '../../../test/probe.ts';

/** The statuses these cases expect. */
const CREATED = 201;
const BAD_REQUEST = 400;
const TOO_LARGE = 413;

/** The ceiling one route sets, and how a body crosses it late. */
const CAPPED = 2048;
const SMALL_PIECES = 64;
const SMALL_PIECE = 512;

/** What the route that answers with a file of its own sends. */
const ELSEWHERE = 'elsewhere';

/** The boundary every body built here is cut with. */
const BOUNDARY = 'stream-boundary';

/** The byte the padding of an unread upload is made of. */
const PADDING = 120;

/** How many pieces that padding arrives in, and how big each is. */
const PIECES = 24;
const PIECE = 8192;

/** Refuses every file, so a case can watch one be skipped. */
/* oxlint-disable promise/prefer-await-to-callbacks, unicorn/no-null */
const refuseAll = (
  _request: unknown,
  _file: unknown,
  callback: (error: Error | null, accept: boolean) => void,
): void => {
  callback(null, false);
};
/* oxlint-enable promise/prefer-await-to-callbacks, unicorn/no-null */

@Controller()
class StreamController {
  @Post('read')
  @UseInterceptors(FileStreamInterceptor('file'))
  public async read(
    @UploadedFile() file: MultipartFileStream | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    if (file === undefined) {
      return { body, hasFile: false };
    }
    return {
      body,
      file: {
        encoding: file.encoding,
        fieldname: file.fieldname,
        mimetype: file.mimetype,
        originalname: file.originalname,
        text: await text(file.stream),
      },
      hasFile: true,
    };
  }

  /** Answers without ever touching the upload. */
  @Post('unread')
  @UseInterceptors(FileStreamInterceptor('file'))
  public unread(
    @UploadedFile() file: MultipartFileStream | undefined,
  ): unknown {
    return { hasFile: file !== undefined };
  }

  /** Answers with the upload itself. */
  @Post('echo')
  @UseInterceptors(FileStreamInterceptor('file'))
  public echo(
    @UploadedFile() file: MultipartFileStream | undefined,
  ): unknown {
    if (file === undefined) {
      return { hasFile: false };
    }
    return new StreamableFile(file.stream);
  }

  /** Answers with a file of its own, leaving the upload unread. */
  @Post('elsewhere')
  @UseInterceptors(FileStreamInterceptor('file'))
  public elsewhere(): StreamableFile {
    return new StreamableFile(Buffer.from(ELSEWHERE));
  }

  /** Reads an upload the route capped. */
  @Post('limited')
  @UseInterceptors(
    FileStreamInterceptor('file', {
      limits: { fileSize: CAPPED },
    }),
  )
  public async limited(
    @UploadedFile() file: MultipartFileStream | undefined,
  ): Promise<unknown> {
    if (file === undefined) {
      return { hasFile: false };
    }
    return { hasFile: true, text: await text(file.stream) };
  }

  /** Reads an upload the filter may have refused. */
  @Post('refused')
  @UseInterceptors(
    FileStreamInterceptor('file', { fileFilter: refuseAll }),
  )
  public refused(
    @UploadedFile() file: MultipartFileStream | undefined,
  ): unknown {
    return { hasFile: file !== undefined };
  }

  /** A route whose body is nothing to do with uploads. */
  @Post('plain')
  @UseInterceptors(FileStreamInterceptor('file'))
  public plain(@Body() body: unknown): unknown {
    return { body };
  }
}

@Module({ controllers: [StreamController] })
class StreamModule {}

/**
 * A body delivered one piece at a time, and how far it was
 * read.
 */
interface PacedBody {
  readonly body: ReadableStream<Uint8Array>;
  readonly finished: () => boolean;
}

/**
 * A multipart body that arrives piece by piece, counting the
 * pieces a reader took. The closing boundary is the last one,
 * so a body read to its end is a body whose reader went all the
 * way — which is what tells a drained request from one that was
 * answered and abandoned.
 */
function pacedBody(count: number, size: number): PacedBody {
  const encoder = new TextEncoder();
  const head =
    `--${BOUNDARY}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="big.txt"\r\n' +
    'Content-Type: text/plain\r\n\r\n';
  const pieces: Uint8Array[] = [encoder.encode(head)];
  for (let index = 0; index < count; index += 1) {
    pieces.push(new Uint8Array(size).fill(PADDING));
  }
  pieces.push(encoder.encode(`\r\n--${BOUNDARY}--\r\n`));
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller): void {
      const piece = pieces[pulled];
      if (piece === undefined) {
        controller.close();
        return;
      }
      controller.enqueue(piece);
      pulled += 1;
    },
  });
  return { body, finished: () => pulled >= pieces.length };
}

/** Starts the streaming module, in process. */
function app(): ReturnType<typeof startProbe> {
  return startProbe({
    mode: 'in-process',
    module: StreamModule,
  });
}

/** Sends one form to a route of a fresh application. */
async function send(
  route: string,
  form: FormData,
): Promise<Awaited<ReturnType<typeof request>>> {
  const probe = await app();
  try {
    return await request(probe, route, {
      body: form,
      method: 'POST',
    });
  } finally {
    await probe.close();
  }
}

/** Sends one hand-built body to a route of a fresh application. */
async function sendBody(
  route: string,
  init: RequestInit & { duplex?: string },
): Promise<Awaited<ReturnType<typeof request>> | 'hung'> {
  const probe = await app();
  try {
    return await withDeadline(
      request(probe, route, init),
      ABORT_DEADLINE,
    );
  } finally {
    await probe.close();
  }
}

/** A body cut with the boundary every case uses. */
function pacedInit(
  paced: PacedBody,
): RequestInit & { duplex?: string } {
  return {
    body: paced.body,
    duplex: 'half',
    headers: {
      'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    },
    method: 'POST',
  };
}

/**
 * Fails the case rather than letting it stall on a hung
 * request.
 */
function answered<Value>(
  outcome: Value | 'hung',
  what: string,
): Value {
  if (outcome === 'hung') {
    throw new Error(`the ${what} never answered`);
  }
  return outcome;
}

describe('a streamed upload, read as it arrives', () => {
  test('the handler reads the bytes as they arrive', async () => {
    const result = await send('/read', filePart('streamed'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toMatchObject({
      file: {
        fieldname: 'file',
        mimetype: 'text/plain',
        originalname: 'a.txt',
        text: 'streamed',
      },
      hasFile: true,
    });
  });

  test('the fields before the file are parsed, the ones after are not', async () => {
    const form = new FormData();
    form.append('title', 'before');
    form.append(
      'file',
      new Blob(['x'], { type: 'text/plain' }),
      'a.txt',
    );
    form.append('after', 'later');

    const result = await send('/read', form);

    expect(result.status).toBe(CREATED);
    expect(asRecord(asRecord(result.body).body)).toEqual({
      title: 'before',
    });
  });

  test('a file in another field is refused', async () => {
    const result = await send(
      '/read',
      filePart('x', { name: 'other' }),
    );

    expect(result.status).toBe(BAD_REQUEST);
  });
});

describe('a streamed upload a route caps or filters', () => {
  test('a file over the limit fails the read, not the parse', async () => {
    const paced = pacedBody(SMALL_PIECES, SMALL_PIECE);

    const outcome = answered(
      await sendBody('/limited', pacedInit(paced)),
      'capped upload',
    );

    expect(outcome.status).toBe(TOO_LARGE);
  });

  test('a file the filter refuses is never handed over', async () => {
    const result = await send('/refused', filePart('x'));

    expect(result.status).toBe(CREATED);
    expect(result.body).toEqual({ hasFile: false });
  });

  test('a body that is not multipart is left to the request path', async () => {
    const probe = await app();
    try {
      const result = await request(probe, '/plain', {
        body: JSON.stringify({ title: 'json' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      expect(result.status).toBe(CREATED);
      expect(asRecord(asRecord(result.body).body)).toEqual({
        title: 'json',
      });
    } finally {
      await probe.close();
    }
  });
});

describe('an upload the handler never reads', () => {
  test('is carried away before the answer', async () => {
    const paced = pacedBody(PIECES, PIECE);

    const outcome = answered(
      await sendBody('/unread', pacedInit(paced)),
      'unread upload',
    );

    expect(outcome.status).toBe(CREATED);
    expect(paced.finished()).toBe(true);
  });

  test('is carried away before an answer that is a file of its own', async () => {
    const paced = pacedBody(PIECES, PIECE);

    const outcome = answered(
      await sendBody('/elsewhere', pacedInit(paced)),
      'answer with a file of its own',
    );

    expect(outcome.status).toBe(CREATED);
    expect(outcome.text).toBe(ELSEWHERE);
    expect(paced.finished()).toBe(true);
  });
});

describe('an answer that streams the upload back', () => {
  test('is not cut short by the discard', async () => {
    const content = 'e'.repeat(PIECES * PIECE);
    const probe = await app();
    try {
      const call = request(probe, '/echo', {
        body: filePart(content),
        method: 'POST',
      });
      const outcome = answered(
        await withDeadline(call, ABORT_DEADLINE),
        'streamed answer',
      );

      expect(outcome.status).toBe(CREATED);
      expect(outcome.text).toBe(content);
    } finally {
      await probe.close();
    }
  });
});

describe('a streamed upload a client abandons', () => {
  test('the read fails and the request still answers', async () => {
    const outcome = answered(
      await sendBody('/read', {
        body: abortingBody(BOUNDARY),
        duplex: 'half',
        headers: {
          'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
        },
        method: 'POST',
      }),
      'aborted upload',
    );

    expect(outcome.status).toBeGreaterThanOrEqual(BAD_REQUEST);
  });
});
