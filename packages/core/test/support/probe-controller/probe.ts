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

  @Get('files/*rest')
  public files(@Req() source: NestRequest): unknown {
    return { params: source.params };
  }
}

export { ProbeController };
