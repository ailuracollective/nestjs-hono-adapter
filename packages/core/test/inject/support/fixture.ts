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

const GIVEN_HEADER = 'x-given';

const SENT_COOKIE = 'session=abc';

const ANSWER_COOKIE = 'session=abc; Path=/; HttpOnly; SameSite=Lax';

const OTHER_COOKIE = 'theme=dark; Path=/';

@Controller()
class InjectController {
  @Get('ping')
  public ping(): unknown {
    return { pong: true };
  }

  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  @Get('seen')
  public seen(@Req() source: NestRequest): unknown {
    return source.headers;
  }

  @Get('text')
  public text(): string {
    return 'plain';
  }

  @Get('cookie')
  @Header('set-cookie', ANSWER_COOKIE)
  public cookie(): unknown {
    return { ok: true };
  }

  @Get('cookies')
  public cookies(@Res({ passthrough: true }) response: NestContext): unknown {
    response.header('set-cookie', ANSWER_COOKIE);
    response.header('set-cookie', OTHER_COOKIE, {
      append: true,
    });
    return { ok: true };
  }

  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }
}

@Module({ controllers: [InjectController] })
class InjectModule {}

export { ANSWER_COOKIE, GIVEN_HEADER, OTHER_COOKIE, SENT_COOKIE, InjectModule };
