import 'reflect-metadata';

import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';

/** A page the surface is asked to send. */
const PAGE = '<!doctype html><title>page</title>';

/** Answers the plain-text route. */
@Controller()
class PageController {
  /** Answers with plain text. */
  @Get('text')
  public text(): string {
    return 'plain';
  }
}

/** The module that wires the page controller. */
@Module({ controllers: [PageController] })
class PageModule {}

/** The answer every case here expects of a page. */
const SERVED = HttpStatus.OK;

/** The surface a module receives as the response. */
interface ExpressResponse {
  send: (body: unknown) => void;
  type: (value: string) => void;
}

/** Says of a value whether it carries the surface. */
const hasSurface = (
  value: unknown,
): value is ExpressResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, 'send') === 'function' &&
    typeof Reflect.get(value, 'type') === 'function'
  );
};

export { PAGE, PageModule, SERVED, hasSurface };
export type { ExpressResponse };
