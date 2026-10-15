import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'bun:test';

import { request } from '#test/probe';

import { withProbe } from './fixture.ts';

describe('the swagger document', () => {
  it('answers the JSON document', async () => {
    await withProbe(async (probe) => {
      const result = await request(probe, '/docs-json');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.contentType).toContain('application/json');
      expect(result.body).toMatchObject({
        info: { title: 'Catalog', version: '1.0' },
      });
      expect(result.text).toContain('"/items"');
    });
  });

  it('answers the YAML document', async () => {
    await withProbe(async (probe) => {
      const result = await request(probe, '/docs-yaml');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.text).toContain('title: Catalog');
    });
  });
});
