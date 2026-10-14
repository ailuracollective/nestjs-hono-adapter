import { expect, test } from 'bun:test';
import { HttpStatus } from '@nestjs/common';

import { startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';

import { ExpressShapedModule } from './express-fixture.ts';

/** Answers one path of the Express-shaped fixture. */
const ask = async (
  path: string,
): Promise<{
  readonly contentType: string;
  readonly status: number;
  readonly text: string;
}> => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ExpressShapedModule,
  });
  try {
    const response = await request(probe, path);
    return {
      contentType: response.contentType,
      status: response.status,
      text: response.text,
    };
  } finally {
    await probe.close();
  }
};

test('a handler answers with res.send()', async () => {
  const response = await ask('/compat/send');
  expect(response.status).toBe(HttpStatus.OK);
  expect(response.text).toBe('through send');
});

test('a handler answers with res.json()', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ExpressShapedModule,
  });
  try {
    const response = await request(probe, '/compat/json');
    expect(response.body).toStrictEqual({ ok: true });
  } finally {
    await probe.close();
  }
});

test('res.status() is the status the answer carries', async () => {
  const probe = await startProbe({
    mode: 'in-process',
    module: ExpressShapedModule,
  });
  try {
    const response = await request(probe, '/compat/created');
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body).toStrictEqual({ created: true });
  } finally {
    await probe.close();
  }
});

test('a string body is labelled the way Express labels it', async () => {
  const response = await ask('/compat/html');
  expect(response.contentType).toContain('text/html');
});

test('a content type the handler declared is kept', async () => {
  const response = await ask('/compat/typed');
  expect(response.contentType).toContain('application/xml');
});

test('the status Nest declared is the one the answer carries', async () => {
  const response = await ask('/compat/declared');
  expect(response.status).toBe(HttpStatus.ACCEPTED);
  expect(response.text).toBe('accepted');
});
