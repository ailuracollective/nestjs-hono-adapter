import { Controller, Get, Module } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { Inertia, InertiaModule, UseInertia } from '@dudousxd/nestjs-inertia';

@Controller()
class ScopeController {
  @Get('/main')
  @Inertia('Main')
  public main(): { value: string } {
    return { value: 'main' };
  }

  @Get('/admin')
  @UseInertia('admin')
  @Inertia('Admin')
  public admin(): { value: string } {
    return { value: 'admin' };
  }
}

const scopesModule = (): Type<unknown> => {
  @Module({
    controllers: [ScopeController],
    imports: [
      InertiaModule.forRoot({
        share: () => ({ app: 'main' }),
        version: 'v1',
      }),
      InertiaModule.forFeature({
        scope: 'admin',
        share: () => ({ app: 'admin' }),
        version: 'admin-v1',
      }),
    ],
  })
  class ScopesFixture {}

  return ScopesFixture;
};

export { scopesModule };
