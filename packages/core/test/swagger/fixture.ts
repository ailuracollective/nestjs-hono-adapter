import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { startProbe } from '#test/probe';
import type { Probe } from '#test/probe';

@Controller()
class CatalogController {
  @Get('items')
  public items(): string[] {
    return ['one', 'two'];
  }
}

@Module({ controllers: [CatalogController] })
class CatalogModule {}

const withProbe = async (run: (probe: Probe) => Promise<void>): Promise<void> => {
  const probe = await startProbe({
    configure: (app) => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Catalog').setVersion('1.0').build(),
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
