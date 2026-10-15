import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { bunAdapter } from '#test/bun-adapter';

import { ask, overConnection, withApplication, withOverriddenGuard } from './application.ts';
import {
  ANY_PORT,
  ClosedModule,
  LOCALHOST,
  OPEN,
  OpenModule,
  TestingController,
} from './fixture.ts';

test('an application built by the testing package routes', async () => {
  const answered = await withApplication(OpenModule, (application) => ask(application, '/ping'));

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
  const answered = await withOverriddenGuard(ClosedModule, (application) =>
    ask(application, '/ping'),
  );

  expect(answered.status).toBe(HttpStatus.OK);
  expect(answered.text).toBe(JSON.stringify(OPEN));
});

test('a guard that refuses is answered by Nest through the adapter', async () => {
  const answered = await withApplication(ClosedModule, (application) => ask(application, '/ping'));

  expect(answered.status).toBe(HttpStatus.FORBIDDEN);
  expect(answered.text).toContain(`"statusCode":${HttpStatus.FORBIDDEN}`);
});

test('an application built by the testing package answers over a connection', async () => {
  const compiled = await Test.createTestingModule({
    imports: [OpenModule],
  }).compile();

  const adapter = bunAdapter();
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
