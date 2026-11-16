import { Controller, Get, Module, Put, Redirect, Req, Res } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { Inertia, InertiaModule } from '@dudousxd/nestjs-inertia';

const FOUND = 302;

const MOVED_PERMANENTLY = 301;

const PERMANENT_REDIRECT = 308;

interface ManualResponse {
  redirect: (statusOrUrl: number | string, url?: string) => unknown;
}

interface InertiaRequest {
  readonly inertia: { location: (url: string) => void };
}

@Controller()
class InertiaController {
  @Get('/')
  @Inertia('Home')
  public home(): Record<string, unknown> {
    return { greeting: 'hello' };
  }

  @Get('/plain')
  public plain(): Record<string, unknown> {
    return { ok: true };
  }

  @Get('/partial')
  @Inertia('Partial')
  public partial(): Record<string, unknown> {
    return {
      first: 'one',
      second: 'two',
      third: Inertia.defer(() => 'later'),
    };
  }

  @Get('/once')
  @Inertia('Once')
  public once(): Record<string, unknown> {
    return { cached: Inertia.once(() => 'yes') };
  }

  @Get('/location')
  public location(@Req() request: InertiaRequest): void {
    request.inertia.location('/elsewhere');
  }

  @Put('/redirect')
  @Redirect('/done')
  public redirect(): void {
    // The decorator answers; the handler has no body.
  }

  @Put('/redirect-explicit')
  @Redirect('/done', PERMANENT_REDIRECT)
  public redirectExplicit(): void {
    // The explicit status is the one that answers.
  }

  @Put('/manual')
  public manual(@Res() response: ManualResponse): void {
    response.redirect('/done');
  }

  @Put('/manual-explicit')
  public manualExplicit(@Res() response: ManualResponse): void {
    response.redirect(MOVED_PERMANENTLY, '/done');
  }

  @Put('/manual-found')
  public manualFound(@Res() response: ManualResponse): void {
    response.redirect(FOUND, '/done');
  }
}

interface InertiaOptions {
  readonly version?: string;
}

/**
 * The module a case serves Inertia from. It names the **stock** `InertiaModule`, so the application
 * imports nothing of the bridge package.
 */
const inertiaModule = (options: InertiaOptions = {}): Type<unknown> => {
  @Module({
    controllers: [InertiaController],
    imports: [
      InertiaModule.forRoot(options.version === undefined ? {} : { version: options.version }),
    ],
  })
  class InertiaFixture {}

  return InertiaFixture;
};

export { inertiaModule };
export type { InertiaOptions };
