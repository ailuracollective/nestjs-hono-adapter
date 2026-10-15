import { describe, expect, it } from 'bun:test';

import { request } from '#test/probe';
import { SERVED } from './fixture.ts';
import { withSurface } from './support.ts';

describe('what res.send() answers for a buffer', () => {
  it('the bytes, keeping a declared type', async () => {
    await withSurface(
      (response) => {
        response.type('image/png');
        response.send(new TextEncoder().encode('PNGBYTES'));
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe('image/png');
        expect(result.text).toBe('PNGBYTES');
      },
    );
  });

  it('the bytes, as an octet stream when no type is declared', async () => {
    await withSurface(
      (response) => {
        response.send(new TextEncoder().encode('raw'));
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe('application/octet-stream');
      },
    );
  });
});
