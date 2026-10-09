/**
 * The cases that show `@nestjs/testing` works on this adapter.
 *
 * The package matters to this repository more than most: it is
 * how the official suites for every other Nest package build
 * the application they exercise, so an application that starts
 * through `Test.createTestingModule` is the path most of this
 * compatibility claim is written in. What is under test here is
 * that `createNestApplication` accepts this adapter and hands
 * back an application that routes, and that the overrides the
 * package offers — a guard, a provider — reach the routes they
 * apply to.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Type,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { ServerAdapter } from '../src/index.ts';

/** What the guarded route answers with. */
const OPEN = { guarded: true };

/** The interface a listening application answers on. */
const LOCALHOST = '127.0.0.1';

/**
 * The port the system is asked to pick for a listening
 * application.
 */
const ANY_PORT = 0;

/**
 * A guard that lets every request through: an override says
 * what the guard does instead of what it replaced, so the case
 * needs a replacement that lets the request through to be seen
 * arriving.
 */
@Injectable()
class OpenGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

/**
 * A guard that refuses, so a case can tell a guard that ran
 * from one that did not: the difference is the answer, which
 * the adapter passes on unchanged.
 */
@Injectable()
class RefusingGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return false;
  }
}

@Controller()
class TestingController {
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

/**
 * A controller under a guard of its own, which is the shape
 * `overrideGuard` matches on: the override names the class the
 * routes were decorated with, not the token a global guard is
 * registered under.
 */
@UseGuards(RefusingGuard)
@Controller()
class GuardedController {
  @Get('ping')
  public ping(): typeof OPEN {
    return OPEN;
  }
}

/** An application whose guard lets every request through. */
@Module({
  controllers: [TestingController],
  providers: [{ provide: APP_GUARD, useClass: OpenGuard }],
})
class OpenModule {}

/** The same application under a guard a case may override. */
@Module({ controllers: [GuardedController] })
class ClosedModule {}

/** What one request against an application saw. */
interface Answered {
  readonly status: number;
  readonly text: string;
}

/**
 * The adapter behind a started application.
 *
 * `createNestApplication` hands back the framework's own
 * `AbstractHttpAdapter`, and `getHono` is what this package
 * adds to it rather than part of the contract Nest declares.
 * The cast goes through `unknown` because the two types share
 * nothing for TypeScript to check it against — the adapter
 * really is that class, and the base type simply does not say
 * so.
 */
function adapterOf(
  application: INestApplication,
): ServerAdapter {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter is that class; the base type Nest hands back simply does not say so.
  return application.getHttpAdapter() as unknown as ServerAdapter;
}

/**
 * Answers one request against a started application, which is
 * the call the official suites make: the adapter's Hono
 * instance is the thing that routes, and asking it directly is
 * what keeps the case about the application rather than about a
 * transport.
 */
async function ask(
  application: INestApplication,
  path: string,
): Promise<Answered> {
  const response = await adapterOf(application)
    .getHono()
    .request(path, { method: 'GET' });
  return {
    status: response.status,
    text: await response.text(),
  };
}

/**
 * Compiles a module, starts an application from it on an
 * adapter of its own, and hands that application to the case.
 *
 * Every case here needs the same three steps, and writing them
 * out five times is what left the last of them with more
 * statements than the rule allows. The reader answers rather
 * than asserting, so what a case checks is visible next to what
 * it set up.
 */
async function withApplication<Answer>(
  module: Type<unknown>,
  read: (application: INestApplication) => Promise<Answer>,
): Promise<Answer> {
  const compiled = await Test.createTestingModule({
    imports: [module],
  }).compile();

  const application = compiled.createNestApplication(
    new ServerAdapter(),
    {
      logger: false,
    },
  );
  try {
    await application.init();
    return await read(application);
  } finally {
    await application.close();
  }
}

/**
 * The same, with the guard the routes run under replaced before
 * the application is built — the one thing `overrideGuard` has
 * to be called before `compile`, so it cannot be an option of
 * the helper above without the override and the start living in
 * the same case.
 */
async function withOverriddenGuard<Answer>(
  module: Type<unknown>,
  read: (application: INestApplication) => Promise<Answer>,
): Promise<Answer> {
  const compiled = await Test.createTestingModule({
    imports: [module],
  })
    .overrideGuard(RefusingGuard)
    .useValue(new OpenGuard())
    .compile();

  const application = compiled.createNestApplication(
    new ServerAdapter(),
    {
      logger: false,
    },
  );
  try {
    await application.init();
    return await read(application);
  } finally {
    await application.close();
  }
}

/**
 * One request against a listening application, over a
 * connection.
 */
async function overConnection(
  adapter: ServerAdapter,
): Promise<Answered> {
  const address = adapter.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new TypeError(
      'the application is not listening on a port',
    );
  }
  const response = await fetch(
    `http://${LOCALHOST}:${address.port}/ping`,
  );
  return {
    status: response.status,
    text: await response.text(),
  };
}

test('an application built by the testing package routes', async () => {
  const answered = await withApplication(
    OpenModule,
    (application) => ask(application, '/ping'),
  );

  expect(answered.status).toBe(HttpStatus.OK);
  expect(answered.text).toBe(JSON.stringify(OPEN));
});

test('the compiled module resolves what the application resolved', async () => {
  const compiled = await Test.createTestingModule({
    imports: [OpenModule],
  }).compile();

  const resolved = compiled.get(TestingController);

  expect(resolved).toBeInstanceOf(TestingController);
});

test('an override replaces the guard the routes ran under', async () => {
  const answered = await withOverriddenGuard(
    ClosedModule,
    (application) => ask(application, '/ping'),
  );

  expect(answered.status).toBe(HttpStatus.OK);
  expect(answered.text).toBe(JSON.stringify(OPEN));
});

test('a guard that refuses is answered by Nest through the adapter', async () => {
  const answered = await withApplication(
    ClosedModule,
    (application) => ask(application, '/ping'),
  );

  expect(answered.status).toBe(HttpStatus.FORBIDDEN);
  expect(answered.text).toContain(
    `"statusCode":${HttpStatus.FORBIDDEN}`,
  );
});

test('an application built by the testing package answers over a connection', async () => {
  const compiled = await Test.createTestingModule({
    imports: [OpenModule],
  }).compile();

  const adapter = new ServerAdapter();
  const application = compiled.createNestApplication(adapter, {
    logger: false,
  });
  await application.listen(ANY_PORT, LOCALHOST);

  try {
    const answered = await overConnection(adapter);
    expect(answered.status).toBe(HttpStatus.OK);
    expect(answered.text).toBe(JSON.stringify(OPEN));
  } finally {
    await application.close();
  }
});
