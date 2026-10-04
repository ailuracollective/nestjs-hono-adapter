/**
 * The fixtures every probe serves: the controllers whose routes
 * a case asks for, and the filter that marks an exception it
 * saw. The probe that serves them lives in `probe.ts`.
 */
import 'reflect-metadata';

import { Readable } from 'node:stream';

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Module,
  Post,
  Query,
  QueryMethod,
  Redirect,
  Render,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  ExceptionFilter,
} from '@nestjs/common';

import type { NestContext, NestRequest } from '../src/index.ts';

/** What a body that is not binary is reported as. */
const NOT_BINARY = -1;

/**
 * A controller just large enough to exercise the bridge: one
 * route per behaviour the adapter has to translate.
 */
@Controller()
class ProbeController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @Get('text')
  public text(): string {
    return 'plain';
  }

  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  @QueryMethod('lookup')
  public lookup(@Req() source: NestRequest): unknown {
    return { method: source.method };
  }

  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }

  @Post('upload')
  public upload(@Req() source: NestRequest): unknown {
    return {
      body: source.body,
      files: Object.keys(source.files ?? {}),
    };
  }

  @Post('binary')
  public binary(@Req() source: NestRequest): unknown {
    const { body } = source;
    if (body instanceof Uint8Array) {
      return { bytes: body.byteLength };
    }
    return { bytes: NOT_BINARY };
  }

  @Post('raw')
  public raw(@Req() source: NestRequest): unknown {
    const { rawBody } = source;
    if (rawBody === undefined) {
      return { raw: '' };
    }
    return { raw: rawBody.toString('utf8') };
  }

  @Get('request')
  public request(@Req() source: NestRequest): unknown {
    return {
      hostname: source.hostname,
      ip: source.ip,
      ips: source.ips,
      protocol: source.protocol,
      secure: source.secure,
    };
  }
}

/**
 * A controller that answers the way an imperative handler does,
 * through the response object rather than a returned value.
 */
@Controller('response')
class ResponseController {
  @Get('imperative')
  public imperative(@Res() response: NestContext): void {
    response.json({ imperative: true }, HttpStatus.CREATED);
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

  @Get('file')
  public file(): StreamableFile {
    return new StreamableFile(Readable.from(['streamed']), {
      disposition: 'attachment; filename="note.txt"',
      type: 'text/plain',
    });
  }
}

/** A controller that answers with a rendered template. */
@Controller('view')
class ViewController {
  @Get()
  @Render('hello')
  public hello(): unknown {
    return { name: 'Nest' };
  }

  @Get('missing')
  @Render('missing')
  public missing(): unknown {
    return {};
  }
}

@Module({
  controllers: [
    ProbeController,
    ResponseController,
    ViewController,
  ],
})
class ProbeModule {}

/** The status an exception carries, or a server error. */
function httpStatusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Marks every exception it sees, so a test can prove that a
 * failure went through the exception layer rather than being
 * answered by the adapter itself.
 */
class MarkerFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const status = httpStatusOf(exception);
    const response = host
      .switchToHttp()
      .getResponse<NestContext>();
    const answer = Response.json({ status }, { status });
    answer.headers.set('x-filtered', 'yes');
    response.res = answer;
  }
}

export { MarkerFilter, ProbeModule };
