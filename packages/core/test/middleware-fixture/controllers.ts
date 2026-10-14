import 'reflect-metadata';

import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
} from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';

import type {
  NestContext,
  NestRequest,
  NextHandler,
} from '#adapter/index';

const MIDDLEWARE_HEADER = 'x-middleware';

/** What the marker middleware puts there. */
const MIDDLEWARE_MARK = 'ran';

/** Marks every request that passed through it. */
@Injectable()
class MarkerMiddleware implements NestMiddleware {
  /** Sets the marker header and continues. */
  public use(
    _request: NestRequest,
    response: NestContext,
    next: NextHandler,
  ): void {
    response.header(MIDDLEWARE_HEADER, MIDDLEWARE_MARK);
    next();
  }
}

/** Routes under a prefix. */
@Controller('api')
class ApiController {
  /** Answers with a fixed object. */
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  /** Answers with the body it received. */
  @Post('ping')
  public pingBack(@Body() body: unknown): unknown {
    return body;
  }
}

/** Routes at the root. */
@Controller()
class RootController {
  /** Answers with a fixed object. */
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }
}

export {
  ApiController,
  MIDDLEWARE_HEADER,
  MIDDLEWARE_MARK,
  MarkerMiddleware,
  RootController,
};
