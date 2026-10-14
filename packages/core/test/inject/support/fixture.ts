import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Module,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import type { NestContext, NestRequest } from '#adapter/index';

/** The header a case sends and reads back. */
const GIVEN_HEADER = 'x-given';

/** The Cookie header a case's cookies are serialised into. */
const SENT_COOKIE = 'session=abc';

/** The `set-cookie` value the cookie route answers with. */
const ANSWER_COOKIE =
  'session=abc; Path=/; HttpOnly; SameSite=Lax';

/** The second cookie a route appends after the first. */
const OTHER_COOKIE = 'theme=dark; Path=/';

/** A controller with one route per behaviour `inject()` has. */
@Controller()
class InjectController {
  /** Answers with a fixed object. */
  @Get('ping')
  public ping(): unknown {
    return { pong: true };
  }

  /** Answers with the body it received. */
  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  /** Answers with the query it received. */
  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  /** Answers with the request headers. */
  @Get('seen')
  public seen(@Req() source: NestRequest): unknown {
    return source.headers;
  }

  /** Answers with plain text. */
  @Get('text')
  public text(): string {
    return 'plain';
  }

  /** Answers with a fixed cookie header. */
  @Get('cookie')
  @Header('set-cookie', ANSWER_COOKIE)
  public cookie(): unknown {
    return { ok: true };
  }

  /** Appends two cookie headers to the answer. */
  @Get('cookies')
  public cookies(
    @Res({ passthrough: true }) response: NestContext,
  ): unknown {
    response.header('set-cookie', ANSWER_COOKIE);
    response.header('set-cookie', OTHER_COOKIE, {
      append: true,
    });
    return { ok: true };
  }

  /** Always throws a forbidden exception. */
  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }
}

/** The module that wires the inject controller. */
@Module({ controllers: [InjectController] })
class InjectModule {}

export {
  ANSWER_COOKIE,
  GIVEN_HEADER,
  OTHER_COOKIE,
  SENT_COOKIE,
  InjectModule,
};
