import 'reflect-metadata';

import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import { Controller, Get, Header, StreamableFile } from '@nestjs/common';

@Controller('response')
class ContentController {
  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), {
      disposition: 'attachment; filename="note.txt"',
      type: 'text/plain',
    });
  }

  @Get('declared-type')
  @Header('Content-Type', 'application/xml')
  public declaredType(): unknown {
    return { declared: 'xml' };
  }

  @Get('inferred-type')
  public inferredType(): unknown {
    return { inferred: 'json' };
  }

  @Get('declared-type-text')
  @Header('Content-Type', 'text/csv')
  public declaredTypeText(): string {
    return 'a,b';
  }

  @Get('bytes')
  public bytes(): Buffer {
    return Buffer.from('raw');
  }
}

export { ContentController };
