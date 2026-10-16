import { createRequire } from 'node:module';

import { expect, test } from 'bun:test';

import { Controller, Get, HttpStatus, Module, UseGuards } from '@nestjs/common';
import type { CanActivate, DynamicModule, Type } from '@nestjs/common';

import type { CompatibilityCase } from '#compat-test/cases/types';
import { loadOptional, withApp } from '#compat-test/support';

const require = createRequire(import.meta.url);

const DEVTOOLS = '@nestjs/devtools-integration';

const AUTHENTICATION = '@nestjs/authentication';

const AUTHORIZATION = '@nestjs/authorization';

const TIMEOUT = 30_000;

interface DevtoolsPackage {
  readonly DevtoolsModule: { register: (options: { http: boolean }) => DynamicModule };
}

interface AuthenticationPackage {
  readonly AuthenticationGuard: Type<CanActivate>;
  readonly AuthenticationModule: { forRoot: (options: Record<string, unknown>) => DynamicModule };
  readonly Public: () => ClassDecorator & MethodDecorator;
}

interface AuthorizationPackage {
  readonly AuthorizationModule: { forRoot: (options: Record<string, unknown>) => DynamicModule };
}

const installed = (specifier: string): boolean => {
  try {
    require.resolve(specifier);
    return true;
  } catch {
    return false;
  }
};

const pingModule = (imports: readonly DynamicModule[]): Type<unknown> => {
  @Controller()
  class Ping {
    @Get('ping')
    public ping(): { ok: boolean } {
      return { ok: true };
    }
  }
  @Module({ controllers: [Ping], imports: [...imports] })
  class Fixture {}
  return Fixture;
};

const servesRoute = async (entry: CompatibilityCase): Promise<void> => {
  await withApp(
    entry.module,
    async (probe) => {
      const answer = await probe.request('/ping');
      expect(answer.status).toBe(HttpStatus.OK);
      expect(answer.body).toStrictEqual({ ok: true });
    },
    entry.options ?? {},
  );
};

test.skipIf(!installed(DEVTOOLS))(
  `${DEVTOOLS} boots on the adapter and serves a route`,
  async () => {
    const pkg = await loadOptional<DevtoolsPackage>(DEVTOOLS);
    if (pkg === undefined) return;
    await servesRoute({
      module: pingModule([pkg.DevtoolsModule.register({ http: false })]),
      name: DEVTOOLS,
    });
  },
  TIMEOUT,
);

test.skipIf(!installed(AUTHENTICATION))(
  `${AUTHENTICATION} boots on the adapter and serves a route`,
  async () => {
    const pkg = await loadOptional<AuthenticationPackage>(AUTHENTICATION);
    if (pkg === undefined) return;
    await servesRoute({
      module: pingModule([
        pkg.AuthenticationModule.forRoot({ allowInMemoryStorage: true, globalGuard: false }),
      ]),
      name: AUTHENTICATION,
    });
  },
  TIMEOUT,
);

test.skipIf(!installed(AUTHORIZATION))(
  `${AUTHORIZATION} boots on the adapter and serves a route`,
  async () => {
    const pkg = await loadOptional<AuthorizationPackage>(AUTHORIZATION);
    if (pkg === undefined) return;
    await servesRoute({
      module: pingModule([pkg.AuthorizationModule.forRoot({ globalGuard: false })]),
      name: AUTHORIZATION,
    });
  },
  TIMEOUT,
);

test.skipIf(!installed(AUTHENTICATION))(
  'the authentication guard refuses an unauthenticated request through the adapter',
  async () => {
    const pkg = await loadOptional<AuthenticationPackage>(AUTHENTICATION);
    if (pkg === undefined) return;
    const authentication = pkg;

    @Controller()
    class Protected {
      @Get('private')
      @UseGuards(authentication.AuthenticationGuard)
      public privateRoute(): { ok: boolean } {
        return { ok: false };
      }

      @Get('open')
      @authentication.Public()
      public open(): { ok: boolean } {
        return { ok: true };
      }
    }
    @Module({
      controllers: [Protected],
      imports: [
        authentication.AuthenticationModule.forRoot({
          allowInMemoryStorage: true,
          globalGuard: false,
        }),
      ],
    })
    class Fixture {}

    await withApp(Fixture, async (probe) => {
      const refused = await probe.request('/private');
      expect(refused.status).toBe(HttpStatus.UNAUTHORIZED);

      const allowed = await probe.request('/open');
      expect(allowed.status).toBe(HttpStatus.OK);
    });
  },
  TIMEOUT,
);
