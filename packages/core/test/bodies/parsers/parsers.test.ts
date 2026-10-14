import { expect, test } from 'bun:test';

import { jsonRequest, startProbe } from '#adapter-test/support/index';
import { request } from '#test/probe';
import { BODY_LIMIT } from '#adapter-test/bodies/support';

import { assertLimit, assertRaw } from './assertions.ts';
import type { CallerOptions } from './assertions.ts';

test.each(['json', 'urlencoded', 'text', 'raw', undefined])(
  'a %s parser call without a limit enables parsing and raw bytes',
  async (type) => {
    const probe = await startProbe({
      adapter: { bodyLimit: BODY_LIMIT },
      application: { bodyParser: false },
      mode: 'in-process',
    });
    try {
      probe.adapter.useBodyParser(type, true);
      const parsed = await request(probe, '/echo', jsonRequest({ name: 'note' }));
      expect(parsed.body).toStrictEqual({ name: 'note' });
      await assertRaw(probe, '{"name":"note"}');
      await assertLimit(probe);
    } finally {
      await probe.close();
    }
  },
);

test.each(['yaml', 'multipart', '', 'JSON'])(
  'an unsupported %s parser leaves adapter state unchanged',
  async (type) => {
    const probe = await startProbe({
      adapter: { bodyLimit: BODY_LIMIT },
      application: { bodyParser: false },
      mode: 'in-process',
    });
    try {
      expect(() => {
        probe.adapter.useBodyParser(type, true, { limit: 1 });
      }).toThrow(TypeError);
      const unparsed = await request(probe, '/echo', jsonRequest({ name: 'note' }));
      expect(unparsed.text).toBe('');
      probe.adapter.registerParserMiddleware();
      await assertRaw(probe, '');
      await assertLimit(probe);
    } finally {
      await probe.close();
    }
  },
);

test('refuses a parser option it cannot honour', async () => {
  const probe = await startProbe({ mode: 'in-process' });
  try {
    const options: CallerOptions = { extended: true };
    let refusal = '';
    try {
      probe.adapter.useBodyParser('urlencoded', false, options);
    } catch (error) {
      if (error instanceof Error) refusal = error.message;
    }
    expect(refusal).toContain('extended');
  } finally {
    await probe.close();
  }
});
