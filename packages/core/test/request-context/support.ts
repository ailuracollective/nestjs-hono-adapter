import type { Probe } from '#test/probe';
import { request, startProbe } from '#test/probe';

import { ContextModule, resetResolutions } from './fixture.ts';
import type { Seen } from './fixture.ts';

/** Reads what an answer reported. */
const seenOf = (body: unknown): Seen => {
  if (typeof body !== 'object' || body === null) {
    throw new TypeError(
      'the route did not answer with an object',
    );
  }
  const same: unknown = Reflect.get(body, 'same');
  const serial: unknown = Reflect.get(body, 'serial');
  const url: unknown = Reflect.get(body, 'url');
  if (
    typeof same !== 'boolean' ||
    typeof serial !== 'number' ||
    typeof url !== 'string'
  ) {
    throw new TypeError(
      'the route did not answer what the case reads',
    );
  }
  return { same, serial, url };
};

/** Reads what one answer reported. */
const seenBy = async (
  probe: Probe,
  path = '/seen',
): Promise<Seen> => {
  const answered = await request(probe, path);
  return seenOf(answered.body);
};

/** Starts the fixture with the counter the serials come from. */
const withProbe = async <Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> => {
  resetResolutions();
  const probe = await startProbe({
    mode: 'in-process',
    module: ContextModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

export { seenBy, seenOf, withProbe };
