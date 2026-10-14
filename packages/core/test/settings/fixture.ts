import path from 'node:path';

import type { ViewEngine } from '#adapter/index';

/** The templates the view cases render. */
const FIXTURES = path.join(
  import.meta.dirname,
  '..',
  'fixtures',
  'views',
);

/** The extension the templates are named with. */
const ENGINE = 'tpl';

/** An engine that renders the `title` local into the template. */
const engine: ViewEngine = (source, data) =>
  source.replace('{{name}}', String(data.title));

export { ENGINE, FIXTURES, engine };
