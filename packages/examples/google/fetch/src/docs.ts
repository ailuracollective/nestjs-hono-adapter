import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import type {
  NestHonoApplication,
  ServerAdapter,
} from '@ailura/nestjs-hono-adapter';

/** The title the document and the reference page carry. */
const TITLE = 'Ailura NestJS + Hono (Cloud Functions)';

/** Serves the OpenAPI document and the reference page. */
const registerDocs = (
  app: NestHonoApplication,
  adapter: ServerAdapter,
): void => {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle(TITLE).setVersion('1.0').build(),
  );

  adapter
    .getHono()
    .get('/v1/docs-json', (context) => context.json(document));

  app.use(
    '/v1/reference',
    apiReference({ content: document, pageTitle: TITLE }),
  );
};

export { registerDocs };
