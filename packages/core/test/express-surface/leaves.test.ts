import { describe, expect, it } from 'bun:test';

import { request, startProbe } from '#test/probe';
import { PageModule, SERVED } from './fixture.ts';

describe('what the adapter leaves alone', () => {
  it('does not change what a handler returns', async () => {
    const probe = await startProbe({
      mode: 'in-process',
      module: PageModule,
    });
    try {
      const result = await request(probe, '/text');
      expect(result.status).toBe(SERVED);
      expect(result.contentType).toBe(
        'text/plain; charset=UTF-8',
      );
      expect(result.text).toBe('plain');
    } finally {
      await probe.close();
    }
  });
});
