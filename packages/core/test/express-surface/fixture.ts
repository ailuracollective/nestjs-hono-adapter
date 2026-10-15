import 'reflect-metadata';

import { Controller, Get, HttpStatus, Module } from '@nestjs/common';

const PAGE = '<!doctype html><title>page</title>';

@Controller()
class PageController {
  @Get('text')
  public text(): string {
    return 'plain';
  }
}

@Module({ controllers: [PageController] })
class PageModule {}

const SERVED = HttpStatus.OK;

interface ExpressResponse {
  send: (body: unknown) => void;
  type: (value: string) => void;
  status: (code: number) => ExpressResponse;
  json: (body: unknown) => void;
}

const hasSurface = (value: unknown): value is ExpressResponse => {
  if (typeof value !== 'object' || value === null) return false;
  return (
    typeof Reflect.get(value, 'send') === 'function' &&
    typeof Reflect.get(value, 'type') === 'function'
  );
};

export { PAGE, PageModule, SERVED, hasSurface };
export type { ExpressResponse };
