import 'reflect-metadata';

import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Module,
  Redirect,
  Res,
  StreamableFile,
} from '@nestjs/common';

import type { NestContext } from '../src/index.ts';

/**
 * The members a Node-style handler reaches for on the object
 * `@Res()` hands it. They are spelled out here rather than
 * borrowed from a Hono context, because the case is about what
 * the adapter has put on that object.
 */
interface NodeResponse {
  end: () => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => boolean;
}

/**
 * A controller that answers the way an imperative handler does,
 * through the response object rather than a returned value,
 * beside the routes that shape the answer a handler declares
 * for itself: a header, a status, a redirect, a file.
 *
 * It sits in its own module because only `./responses.test.ts`
 * asks for these routes, and the routes it declares are what
 * that file is about: the shape of the answer, not the bridge
 * that delivers it.
 */
@Controller('response')
class ResponseController {
  @Get('imperative')
  public imperative(@Res() response: NestContext): void {
    response.json({ imperative: true }, HttpStatus.CREATED);
  }

  @Get('writer')
  public writer(@Res() response: NodeResponse): void {
    response.setHeader('x-written', 'yes');
    response.write('hello');
    response.end();
  }

  @Get('passthrough')
  public passthrough(
    @Res({ passthrough: true }) response: NestContext,
  ): unknown {
    response.header('x-passthrough', 'yes');
    return { passthrough: true };
  }

  @Get('decorated')
  @Header('x-decorated', 'yes')
  @HttpCode(HttpStatus.ACCEPTED)
  public decorated(): unknown {
    return { decorated: true };
  }

  @Get('redirect')
  @Redirect(
    'https://example.com/',
    HttpStatus.MOVED_PERMANENTLY,
  )
  public redirect(): unknown {
    return {};
  }

  @Get('no-content')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContent(): unknown {
    return { discarded: true };
  }

  @Get('no-content-text')
  @HttpCode(HttpStatus.NO_CONTENT)
  public noContentText(): string {
    return 'discarded';
  }

  @Get('reset-content')
  @HttpCode(HttpStatus.RESET_CONTENT)
  public resetContent(): unknown {
    return { reset: true };
  }

  @Get('not-modified')
  @HttpCode(HttpStatus.NOT_MODIFIED)
  public notModified(): unknown {
    return { cached: true };
  }

  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), {
      disposition: 'attachment; filename="note.txt"',
      type: 'text/plain',
    });
  }

  /**
   * A handler that names the type it means to send, with a
   * value the adapter has to serialize itself. The type the
   * body is labelled with is the handler's declaration to make;
   * how the body is serialized is the adapter's own business,
   * and the two are not the same decision.
   */
  @Get('declared-type')
  @Header('Content-Type', 'application/xml')
  public declaredType(): unknown {
    return { declared: 'xml' };
  }

  /**
   * The same shape of value with nothing declared, so the type
   * the adapter infers is what answers. Without this route a
   * fix that always honoured a declaration would still pass.
   */
  @Get('inferred-type')
  public inferredType(): unknown {
    return { inferred: 'json' };
  }

  /**
   * A declared type on a primitive, which reaches the branch
   * that already reads the declaration before it defaults.
   */
  @Get('declared-type-text')
  @Header('Content-Type', 'text/csv')
  public declaredTypeText(): string {
    return 'a,b';
  }

  /**
   * Raw bytes with nothing declared, so the binary branch of
   * the answer is what a case reads: the body has to reach the
   * client as bytes, labelled with the type the adapter infers
   * for them.
   */
  @Get('bytes')
  public bytes(): Buffer {
    return Buffer.from('raw');
  }
}

@Module({ controllers: [ResponseController] })
class ResponseModule {}

export { ResponseModule };
