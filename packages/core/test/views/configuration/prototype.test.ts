import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { ENGINE, FIXTURES } from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';

// oxlint-disable-next-line unicorn/no-null -- a null local must be stored as data too.
test.each([{ injected: true }, 'ordinary data', null])(
  '__proto__ is passed to the engine as an own local: %j',
  async (value) => {
    const probe = await startProbe({
      adapter: {
        views: {
          directory: FIXTURES,
          engine: (_source, data) =>
            JSON.stringify([
              Object.hasOwn(data, '__proto__'),
              Object.getPrototypeOf(data) === Object.prototype,
              data,
            ]),
        },
      },
      configure: (app) => {
        app.setLocal('__proto__', value);
        app.setViewEngine({
          defaultContext: { title: 'default' },
          viewExt: ENGINE,
        });
        app.setLocal('title', 'local');
      },
      mode: 'in-process',
    });
    try {
      const response = await request(probe, '/view');
      expect(response.status).toBe(HttpStatus.OK);
      expect(JSON.parse(response.text)).toStrictEqual([
        true,
        true,
        Object.fromEntries([
          ['__proto__', value],
          ['name', 'Nest'],
          ['title', 'local'],
        ]),
      ]);
    } finally {
      await probe.close();
    }
  },
);
