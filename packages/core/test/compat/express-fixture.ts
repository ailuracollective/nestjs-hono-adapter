import 'reflect-metadata';

import { Controller, Get, HttpCode, HttpStatus, Module, Res } from '@nestjs/common';

/**
 * The members a handler written the Express way calls on the object `@Res()` hands it. This is what
 * the `express` bridge fits onto the request's Hono context.
 */
interface ExpressResponse {
  json: (body: unknown) => void;
  send: (body: unknown) => void;
  status: (code: number) => unknown;
  type: (value: string) => unknown;
}

@Controller('compat')
class ExpressShapedController {
  @Get('send')
  public send(@Res() response: ExpressResponse): void {
    response.send('through send');
  }

  @Get('created')
  public created(@Res() response: ExpressResponse): void {
    response.status(HttpStatus.CREATED);
    response.send({ created: true });
  }

  @Get('json')
  public json(@Res() response: ExpressResponse): void {
    response.json({ ok: true });
  }

  @Get('html')
  public html(@Res() response: ExpressResponse): void {
    response.send('<h1>hello</h1>');
  }

  @Get('typed')
  public typed(@Res() response: ExpressResponse): void {
    response.type('application/xml');
    response.send('<hello/>');
  }

  @Get('declared')
  @HttpCode(HttpStatus.ACCEPTED)
  public declared(@Res() response: ExpressResponse): void {
    response.send('accepted');
  }
}

@Module({ controllers: [ExpressShapedController] })
class ExpressShapedModule {}

export { ExpressShapedController, ExpressShapedModule };
export type { ExpressResponse };
