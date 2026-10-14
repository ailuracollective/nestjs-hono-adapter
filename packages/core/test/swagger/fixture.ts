import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { startProbe } from '#test/probe';
import type { Probe } from '#test/probe';

/** A controller with one documented route. */
@Controller()
class CatalogController {
  /** Answers the two catalog items. */
  @Get('items')
  public items(): string[] {
    return ['one', 'two'];
  }
}

/** The module declaring the catalog controller. */
@Module({ controllers: [CatalogController] })
class CatalogModule {}

/** Starts an application with the swagger UI set up at `/docs`. */
const withProbe = async (
  run: (probe: Probe) => Promise<void>,
): Promise<void> => {
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
};

export { CatalogController, CatalogModule, withProbe };
