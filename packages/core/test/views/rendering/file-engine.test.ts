// oxlint-disable promise/prefer-await-to-callbacks -- an Express view engine is defined by the callback it answers through.
import { readFile } from 'node:fs';
import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { ENGINE, FIXTURES } from '#adapter-test/views/engine';
import { startProbe } from '#adapter-test/support/index';
import type { ViewData } from '#adapter/index';

let received: ViewData = {};

// The Express selector: the engine reads the file it is handed and answers through the callback.
const expressEngine = (
  filePath: string,
  data: ViewData,
  callback: (error: unknown, html?: string) => void,
): void => {
  received = data;
  readFile(filePath, 'utf8', (error, source) => {
    if (error) {
      callback(error);
      return;
    }
    callback(undefined, source.replace('{{name}}', String(data.name)));
  });
};

interface EngineHost {
  engine: (extension: string, engine: unknown) => void;
}

test('a view renders with the engine registered by extension', async () => {
  const probe = await startProbe({
    adapter: { views: { directory: FIXTURES } },
    configure: (app) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `app.engine()` is Express-platform API; the adapter answers it.
      (app as unknown as EngineHost).engine(ENGINE, expressEngine);
      app.setViewEngine(ENGINE);
    },
    mode: 'in-process',
  });
  try {
    const response = await request(probe, '/view');
    expect(response.status).toBe(HttpStatus.OK);
    expect(response.contentType).toContain('text/html');
    expect(response.text).toBe('hello Nest\n');
    // The app settings an Express engine reaches for travel with the locals.
    expect(received.settings).toStrictEqual({ 'view engine': ENGINE, views: [FIXTURES] });
  } finally {
    await probe.close();
  }
});
