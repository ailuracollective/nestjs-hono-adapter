import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Module,
  Post,
  Redirect,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  CsrfCookieInterceptor,
  CsrfGuard,
  ErrorBagInterceptor,
  Inertia,
  InertiaModule,
} from '@dudousxd/nestjs-inertia';
import type { FlashData, FlashErrors, FlashStore } from '@dudousxd/nestjs-inertia';

const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const CSRF_SECRET = 'test-secret';

const fromHeader = (target: unknown, name: string): string | undefined => {
  if (typeof target !== 'object' || target === null) return undefined;
  const header: unknown = Reflect.get(target, 'header');
  if (typeof header !== 'function') return undefined;
  const value: unknown = Reflect.apply(header, target, [name]);
  return typeof value === 'string' ? value : undefined;
};

const fromHeaders = (target: unknown, name: string): string | undefined => {
  if (typeof target !== 'object' || target === null) return undefined;
  const headers: unknown = Reflect.get(target, 'headers');
  if (typeof headers !== 'object' || headers === null) return undefined;
  const value: unknown = Reflect.get(headers, name.toLowerCase());
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') return entry;
    }
    return undefined;
  }
  return typeof value === 'string' ? value : undefined;
};

const headerOf = (req: unknown, name: string): string | undefined => {
  if (typeof req !== 'object' || req === null) return undefined;
  const direct = fromHeader(req, name);
  if (direct !== undefined) return direct;
  const honoRequest: unknown = Reflect.get(req, 'req');
  const nested = fromHeader(honoRequest, name);
  if (nested !== undefined) return nested;
  return fromHeaders(req, name);
};

const keyOf = (req: unknown): string => headerOf(req, 'x-test-session') ?? 'default';

class MemoryFlashStore implements FlashStore {
  private readonly errors = new Map<string, FlashErrors>();
  private readonly flash = new Map<string, FlashData>();

  public read(req: unknown): FlashErrors {
    const key = keyOf(req);
    const value = this.errors.get(key) ?? {};
    this.errors.delete(key);
    return value;
  }

  public write(req: unknown, errors: FlashErrors): void {
    this.errors.set(keyOf(req), errors);
  }

  public readFlash(req: unknown): FlashData {
    const key = keyOf(req);
    const value = this.flash.get(key) ?? {};
    this.flash.delete(key);
    return value;
  }

  public writeFlash(req: unknown, data: FlashData): void {
    const key = keyOf(req);
    const existing = this.flash.get(key) ?? {};
    const merged: FlashData = {};
    for (const [name, value] of Object.entries(existing)) merged[name] = value;
    for (const [name, value] of Object.entries(data)) merged[name] = value;
    this.flash.set(key, merged);
  }
}

const flashStore = new MemoryFlashStore();

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

  @Get('/props')
  @Inertia('Props/Index')
  public props(@Req() req: { inertia: { clearHistory: () => void } }): Record<string, unknown> {
    req.inertia.clearHistory();
    return {
      always: Inertia.always(() => 'always'),
      deep: Inertia.merge(() => ({ nested: 1 }), { deep: true }),
      merged: Inertia.merge(() => [{ id: 1 }], { matchOn: 'id' }),
      optional: Inertia.optional(() => 'optional'),
      prepended: Inertia.merge(() => [1], { prepend: true }),
      scroll: Inertia.scroll(
        () => ({
          currentPage: 1,
          data: [{ id: 1 }],
          nextPage: 2,
        }),
        { matchOn: 'id', pageName: 'page' },
      ),
    };
  }

  @Get('/encrypt')
  @Inertia('Props/Index')
  public encrypt(@Req() req: { inertia: { encryptHistory: () => void } }): Record<string, unknown> {
    req.inertia.encryptHistory();
    return { ok: true };
  }

  @Get('/plain')
  public plain(): { ok: boolean } {
    return { ok: true };
  }

  @Get('/fragment')
  @Redirect('/users#section')
  public fragment(): void {
    /* The decorator answers the redirect. */
  }

  @Delete('/users-fragment/:id')
  @Redirect('/users#section')
  public removeFragment(): void {
    /* The decorator answers the redirect. */
  }

  @Delete('/users-fragment-res/:id')
  public removeFragmentRes(@Res() res: { redirect: (url: string) => void }): void {
    res.redirect('/users#section');
  }

  @Get('/bag')
  @Inertia('Bag/Index')
  @UseInterceptors(ErrorBagInterceptor)
  public bag(): { errors: Record<string, string> } {
    return { errors: { email: 'Invalid' } };
  }

  @Post('/validate')
  public validate(): never {
    throw new BadRequestException({ __inertiaErrors: { email: 'Invalid' } });
  }

  @Post('/flash')
  public async flash(
    @Req() req: { inertia: { flash: (key: string, value: string) => Promise<void> } },
    @Res() res: { redirect: (url: string, status: number) => void },
  ): Promise<void> {
    await req.inertia.flash('success', 'Saved');
    res.redirect('/users', SEE_OTHER);
  }

  @Get('/csrf')
  @UseInterceptors(new CsrfCookieInterceptor({ secret: CSRF_SECRET }))
  public csrf(): { ok: boolean } {
    return { ok: true };
  }

  @Post('/csrf')
  @UseGuards(new CsrfGuard({ secret: CSRF_SECRET }))
  public csrfSubmit(): { ok: boolean } {
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
    imports: [
      InertiaModule.forRoot({
        flashStore,
        historyEncryption: { default: false },
        validation: { enabled: true, fallbackRedirect: '/users' },
        version: 'v1',
      }),
    ],
  })
  class InertiaFixture {}

  return InertiaFixture;
};

export { inertiaModule };
