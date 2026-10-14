import type { Probe } from '#test/probe';
import { startProbe } from '#test/probe';

import { BEARER, TokenModule } from './fixture.ts';
import { objectOf } from './read.ts';

const authorized = (token: string): RequestInit => ({
  headers: { [BEARER]: `Bearer ${token}` },
});

const tokenOf = (body: unknown): string => {
  const signed = objectOf(body);
  const token = Reflect.get(signed, 'token');
  if (typeof token !== 'string') throw new TypeError('the application answered without a token');
  return token;
};

const withProbe = async <Answer>(read: (probe: Probe) => Promise<Answer>): Promise<Answer> => {
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
