import 'reflect-metadata';

import { Controller, Get, HttpStatus, Res } from '@nestjs/common';

import type { NestContext } from '#adapter/index';

interface NodeResponse {
  end: () => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => boolean;
}

@Controller('response')
class ImperativeController {
  @Get('imperative')
  public imperative(@Res() response: NestContext): void {
    response.json({ imperative: true }, HttpStatus.CREATED);
  }

  @Get('writer')
  public writer(@Res() response: NodeResponse): void {
    response.setHeader('x-written', 'yes');
    response.write('hello');
    response.end();
  }

  @Get('passthrough')
  public passthrough(@Res({ passthrough: true }) response: NestContext): unknown {
    response.header('x-passthrough', 'yes');
    return { passthrough: true };
  }
}

export { ImperativeController };
