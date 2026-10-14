import { expect, test } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import type { Probe } from '#test/probe';

/** Simulates a host that supports only UTF-8 and UTF-16LE. */
const NativeDecoder = globalThis.TextDecoder;

/** A decoder that refuses a UTF-16BE label. */
class LimitedDecoder extends NativeDecoder {
  /** Throws for a UTF-16BE label and builds the rest. */
  public constructor(
    label?: ConstructorParameters<typeof NativeDecoder>[0],
    options?: ConstructorParameters<typeof NativeDecoder>[1],
  ) {
    if (label === 'utf-16be') {
      throw new RangeError('Unsupported encoding');
    }
    super(label, options);
  }
}

/** The default charset still works on the limited host. */
const assertNormal = async (probe: Probe): Promise<void> => {
  const normal = await probe.respond('/echo', {
    body: '{"hello":"world"}',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  expect(normal.status).toBe(HttpStatus.CREATED);
  expect(await normal.json()).toStrictEqual({ hello: 'world' });
};

/** An unsupported charset reaches Nest's exception layer. */
const assertUnsupported = async (
  probe: Probe,
  charset: string,
): Promise<void> => {
  const unsupported = await probe.respond('/echo', {
    body: new Uint8Array(),
    headers: {
      'content-type': `application/json; charset=${charset}`,
    },
    method: 'POST',
  });
  expect(unsupported.status).toBe(
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  );
  expect(unsupported.headers.get('x-filtered')).toBe('yes');
};

test('UTF-16BE support is needed only by a request declaring it', async () => {
  globalThis.TextDecoder = LimitedDecoder;
  try {
    const { startProbe, MarkerFilter } =
      await import('#adapter-test/support/index');
    const probe = await startProbe({
      configure: (app) => {
        app.useGlobalFilters(new MarkerFilter());
      },
      mode: 'in-process',
    });
    try {
      await assertNormal(probe);
      await Promise.all(
        ['utf-16be', 'UTF16BE'].map((charset) =>
          assertUnsupported(probe, charset),
        ),
      );
    } finally {
      await probe.close();
    }
  } finally {
    globalThis.TextDecoder = NativeDecoder;
  }
});
