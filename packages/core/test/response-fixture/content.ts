import 'reflect-metadata';

import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import {
  Controller,
  Get,
  Header,
  StreamableFile,
} from '@nestjs/common';

/**
 * The routes that answer files, bytes and declared content
 * types.
 */
@Controller('response')
class ContentController {
  /** Answers with a streamed file. */
  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), {
      disposition: 'attachment; filename="note.txt"',
      type: 'text/plain',
    });
  }

  /** A handler that names the content type it sends. */
  @Get('declared-type')
  @Header('Content-Type', 'application/xml')
  public declaredType(): unknown {
    return { declared: 'xml' };
  }

  /** A handler that names no content type. */
  @Get('inferred-type')
  public inferredType(): unknown {
    return { inferred: 'json' };
  }

  /** A handler that declares a type on a string body. */
  @Get('declared-type-text')
  @Header('Content-Type', 'text/csv')
  public declaredTypeText(): string {
    return 'a,b';
  }

  /** A handler that returns raw bytes. */
  @Get('bytes')
  public bytes(): Buffer {
    return Buffer.from('raw');
  }
}

export { ContentController };
