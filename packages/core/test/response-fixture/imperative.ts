import 'reflect-metadata';

import {
  Controller,
  Get,
  HttpStatus,
  Res,
} from '@nestjs/common';

import type { NestContext } from '#adapter/index';

/** The response members a Node-style handler reaches for. */
interface NodeResponse {
  end: () => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => boolean;
}

/** A controller whose routes shape the answers they declare. */
@Controller('response')
class ImperativeController {
  /** Answers through the response object. */
  @Get('imperative')
  public imperative(@Res() response: NestContext): void {
    response.json({ imperative: true }, HttpStatus.CREATED);
  }

  /** Writes the answer through the raw response. */
  @Get('writer')
  public writer(@Res() response: NodeResponse): void {
    response.setHeader('x-written', 'yes');
    response.write('hello');
    response.end();
  }

  /** Answers a value and keeps the header it set. */
  @Get('passthrough')
  public passthrough(
    @Res({ passthrough: true }) response: NestContext,
  ): unknown {
    response.header('x-passthrough', 'yes');
    return { passthrough: true };
  }
}

export { ImperativeController };
