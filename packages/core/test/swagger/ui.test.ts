import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'bun:test';

import { request } from '#test/probe';

import { withProbe } from './fixture.ts';

describe('the swagger UI page', () => {
  it('answers the page itself as HTML', async () => {
    await withProbe(async (probe) => {
      const result = await request(probe, '/docs');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.contentType).toContain('text/html');
    });
  });

  it('answers the page at its own name too', async () => {
    await withProbe(async (probe) => {
      const result = await request(probe, '/docs/index.html');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.contentType).toContain('text/html');
    });
  });

  it('serves a swagger UI asset off the filesystem', async () => {
    await withProbe(async (probe) => {
      const result = await request(
        probe,
        '/docs/swagger-ui.css',
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.contentType).toContain('text/css');
    });
  });

  it('serves the bootstrap script as JavaScript', async () => {
    await withProbe(async (probe) => {
      const result = await request(
        probe,
        '/docs/swagger-ui-init.js',
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.contentType).toContain(
        'application/javascript',
      );
    });
  });
});
