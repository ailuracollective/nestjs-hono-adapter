import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  QueryMethod,
  Req,
} from '@nestjs/common';

import type { NestRequest } from '#adapter/index';

/** A controller with one route per translated behaviour. */
@Controller()
class ProbeController {
  /** Answers with a pong object. */
  @Get('ping')
  public ping(): { readonly pong: boolean } {
    return { pong: true };
  }

  /** Answers with a plain string. */
  @Get('text')
  public text(): string {
    return 'plain';
  }

  /** Answers with the body it was given. */
  @Post('echo')
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  /** Answers with the query it was given. */
  @Get('query')
  public query(@Query() query: unknown): unknown {
    return query;
  }

  /** Answers with the method the route was reached by. */
  @QueryMethod('lookup')
  public lookup(@Req() source: NestRequest): unknown {
    return { method: source.method };
  }

  /** Throws a forbidden exception. */
  @Get('boom')
  public boom(): never {
    throw new ForbiddenException('nope');
  }

  /** Answers with the request fields it was handed. */
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

  /** A route ending in a wildcard, answering its capture. */
  @Get('files/*rest')
  public files(@Req() source: NestRequest): unknown {
    return { params: source.params };
  }
}

export { ProbeController };
