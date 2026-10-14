import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import { BEARER, TokenModule } from './fixture.ts';
import { objectOf } from './read.ts';

/** How a case sends a token to the route that reads one. */
const authorized = (token: string): RequestInit => ({
  headers: { [BEARER]: `Bearer ${token}` },
});

/** Reads a token out of the answer the signing route gave. */
const tokenOf = (body: unknown): string => {
  const signed = objectOf(body);
  const token = Reflect.get(signed, 'token');
  if (typeof token !== 'string') {
    throw new TypeError(
      'the application answered without a token',
    );
  }
  return token;
};

/** Starts the fixture and hands it to the case. */
const withProbe = async <Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> => {
  const probe = await startProbe({
    mode: 'in-process',
    module: TokenModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
};

export { authorized, tokenOf, withProbe };
