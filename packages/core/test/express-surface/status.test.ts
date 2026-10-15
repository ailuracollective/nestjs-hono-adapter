import { describe, expect, it } from 'bun:test';

import { HttpStatus } from '@nestjs/common';

import { request } from '#test/probe';

import { withSurface } from './support.ts';

// Express chains `res.status(code).send(body)` / `.json(body)`; Hono's own `status` returns `void`,
// so these pin the Express meaning, including the status reaching the answer Hono builds.

describe('what a chained status answers', () => {
  it('carries the status res.status().send() declares', async () => {
    await withSurface(
      (response) => {
        response.status(HttpStatus.CREATED).send({ created: true });
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(HttpStatus.CREATED);
        expect(result.body).toEqual({ created: true });
      },
    );
  });

  it('carries the status res.status().json() declares', async () => {
    await withSurface(
      (response) => {
        response.status(HttpStatus.NOT_FOUND).json({ missing: true });
      },
      async (probe) => {
        const result = await request(probe, '/reference');
        expect(result.status).toBe(HttpStatus.NOT_FOUND);
        expect(result.body).toEqual({ missing: true });
      },
    );
  });
});
