import { describe, expect, it } from 'bun:test';

import { request } from '#test/probe';
import { PAGE, SERVED } from './fixture.ts';
import { withSurface } from './support.ts';

describe('what res.send() answers', () => {
  it('a string sent as a document as HTML', async () => {
    await withSurface(
      (response) => {
        response.send(PAGE);
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe('text/html; charset=UTF-8');
        expect(result.text).toContain('<title>page</title>');
      },
    );
  });

  it('leaves a type the caller declared alone', async () => {
    await withSurface(
      (response) => {
        response.type('text/plain');
        response.send(PAGE);
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toBe('text/plain');
      },
    );
  });

  it('leaves an object sent as JSON alone', async () => {
    await withSurface(
      (response) => {
        response.send({ sent: true });
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(SERVED);
        expect(result.contentType).toContain('application/json');
        expect(result.body).toEqual({ sent: true });
      },
    );
  });
});
