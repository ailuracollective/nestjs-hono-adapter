import { text } from 'node:stream/consumers';

import {
  Body,
  Controller,
  Module,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import type { MultipartFileStream } from '#multipart/index';
import { FileStreamInterceptor } from '#multipart/index';
import { CAPPED, ELSEWHERE } from './constants.ts';

/** Refuses every file. */
/* oxlint-disable promise/prefer-await-to-callbacks, unicorn/no-null */
const refuseAll = (
  _request: unknown,
  _file: unknown,
  callback: (error: Error | null, accept: boolean) => void,
): void => {
  callback(null, false);
};
/* oxlint-enable promise/prefer-await-to-callbacks, unicorn/no-null */

/** The controller whose routes read one streamed file. */
@Controller()
class StreamController {
  /** Reads the streamed file and the fields before it. */
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

  /** Answers without reading the upload. */
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

  /** Answers with a file of its own. */
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

/** The module that registers the streaming controller. */
@Module({ controllers: [StreamController] })
class StreamModule {}

export { StreamModule };
