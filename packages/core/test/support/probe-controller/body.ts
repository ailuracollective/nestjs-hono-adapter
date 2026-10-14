import { Controller, Post, Req } from '@nestjs/common';

import type { NestRequest } from '#adapter/index';

/** What a body that is not binary is reported as. */
const NOT_BINARY = -1;

/** The routes that read a body the adapter decoded. */
@Controller()
class BodyController {
  /** Answers with the body and the file names it was given. */
  @Post('upload')
  public upload(@Req() source: NestRequest): unknown {
    return {
      body: source.body,
      files: Object.keys(source.files ?? {}),
    };
  }

  /** Answers with the byte length of the body. */
  @Post('binary')
  public binary(@Req() source: NestRequest): unknown {
    const { body } = source;
    if (body instanceof Uint8Array) {
      return { bytes: body.byteLength };
    }
    return { bytes: NOT_BINARY };
  }

  /** Answers with the raw body as text. */
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
