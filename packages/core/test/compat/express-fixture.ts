import 'reflect-metadata';

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Res,
} from '@nestjs/common';

/**
 * The members a handler written the Express way calls on the
 * object `@Res()` hands it. This is what the `express` bridge
 * fits onto Hono's context prototype.
 */
interface ExpressResponse {
  /** Answers with a JSON body. */
  json: (body: unknown) => void;
  /** Answers with a string or an object body. */
  send: (body: unknown) => void;
  /** Records the status the answer carries. */
  status: (code: number) => unknown;
  /** Declares the content type of the answer. */
  type: (value: string) => unknown;
}

/** A controller that answers the way Express code is written. */
@Controller('compat')
class ExpressShapedController {
  /** Answers through `res.send()`, as an Express handler would. */
  @Get('send')
  public send(@Res() response: ExpressResponse): void {
    response.send('through send');
  }

  /** Answers through `res.status()` and `res.send()`. */
  @Get('created')
  public created(@Res() response: ExpressResponse): void {
    response.status(HttpStatus.CREATED);
    response.send({ created: true });
  }

  /** Answers through `res.json()`, as an Express handler would. */
  @Get('json')
  public json(@Res() response: ExpressResponse): void {
    response.json({ ok: true });
  }

  /** Labels a string body the way Express labels it. */
  @Get('html')
  public html(@Res() response: ExpressResponse): void {
    response.send('<h1>hello</h1>');
  }

  /** Keeps the content type it declared itself. */
  @Get('typed')
  public typed(@Res() response: ExpressResponse): void {
    response.type('application/xml');
    response.send('<hello/>');
  }

  /** Answers a route Nest declared a status for. */
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
