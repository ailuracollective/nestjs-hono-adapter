import 'reflect-metadata';

import {
  Controller,
  Get,
  HttpStatus,
  Module,
} from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { describe, expect, it } from 'bun:test';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/**
 * A controller with one documented route, which is what the
 * document is built from.
 */
@Controller()
class CatalogController {
  @Get('items')
  public items(): string[] {
    return ['one', 'two'];
  }
}

@Module({ controllers: [CatalogController] })
class CatalogModule {}

/**
 * Starts an application with the swagger UI set up at `/docs`,
 * the way a deployment that documents itself does.
 */
async function withProbe(
  run: (probe: Probe) => Promise<void>,
): Promise<void> {
  const probe = await startProbe({
    configure: (app) => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('Catalog')
          .setVersion('1.0')
          .build(),
      );
      SwaggerModule.setup('docs', app, document);
    },
    mode: 'in-process',
    module: CatalogModule,
  });
  try {
    await run(probe);
  } finally {
    await probe.close();
  }
}

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
