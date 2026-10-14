import 'reflect-metadata';

import { Body, Controller, Get, Injectable, Post } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';

import type { NestContext, NestRequest, NextHandler } from '#adapter/index';

const MIDDLEWARE_HEADER = 'x-middleware';

const MIDDLEWARE_MARK = 'ran';

@Injectable()
class MarkerMiddleware implements NestMiddleware {
  public use(_request: NestRequest, response: NestContext, next: NextHandler): void {
    response.header(MIDDLEWARE_HEADER, MIDDLEWARE_MARK);
    next();
  }
}

@Controller('api')
class ApiController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  @Post('ping')
  public pingBack(@Body() body: unknown): unknown {
    return body;
  }
}

@Controller()
class RootController {
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }
}

export { ApiController, MIDDLEWARE_HEADER, MIDDLEWARE_MARK, MarkerMiddleware, RootController };
