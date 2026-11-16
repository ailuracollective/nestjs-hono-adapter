import { Controller, Delete, Get, Module, Redirect, Req, Res } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { Inertia, InertiaModule } from '@dudousxd/nestjs-inertia';

const MOVED_PERMANENTLY = 301;
const FOUND = 302;

@Controller()
class InertiaController {
  @Get('/users')
  @Inertia('Users/Index')
  public users(): Record<string, unknown> {
    return {
      stats: Inertia.defer(() => ({ count: 7 })),
      token: Inertia.once(() => 'tok-1'),
      users: [{ id: 1, name: 'Ada' }],
    };
  }

  @Delete('/users/:id')
  @Redirect('/users')
  public remove(): void {
    /* The decorator answers the redirect. */
  }

  @Delete('/users-res/:id')
  public removeRes(@Res() res: { redirect: (url: string) => void }): void {
    res.redirect('/users');
  }

  @Delete('/users-decorator-301/:id')
  @Redirect('/users', MOVED_PERMANENTLY)
  public removeDecorator301(): void {
    /* The decorator answers the redirect. */
  }

  @Delete('/users-express-301/:id')
  public removeExpress301(@Res() res: { redirect: (status: number, url: string) => void }): void {
    res.redirect(MOVED_PERMANENTLY, '/users');
  }

  @Delete('/users-hono-301/:id')
  public removeHono301(@Res() res: { redirect: (url: string, status: number) => void }): void {
    res.redirect('/users', MOVED_PERMANENTLY);
  }

  @Delete('/users-express-302/:id')
  public removeExpress302(@Res() res: { redirect: (status: number, url: string) => void }): void {
    res.redirect(FOUND, '/users');
  }

  @Delete('/users-hono-302/:id')
  public removeHono302(@Res() res: { redirect: (url: string, status: number) => void }): void {
    res.redirect('/users', FOUND);
  }

  @Get('/location')
  public location(@Req() req: { inertia: { location: (url: string) => void } }): void {
    req.inertia.location('/out');
  }

  @Get('/plain')
  public plain(): { ok: boolean } {
    return { ok: true };
  }
}

/**
 * The fixture names the stock Inertia module: the bridge is installed by the adapter's discovery,
 * so an application writes no import of it.
 */
const inertiaModule = (): Type<unknown> => {
  @Module({
    controllers: [InertiaController],
    imports: [InertiaModule.forRoot({ version: 'v1' })],
  })
  class InertiaFixture {}

  return InertiaFixture;
};

export { inertiaModule };
