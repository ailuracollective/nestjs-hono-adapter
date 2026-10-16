import { Controller, Post, Req } from '@nestjs/common';

import type { NestRequest } from '#adapter/index';

const NOT_BINARY = -1;

@Controller()
class BodyController {
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
}

export { BodyController };
