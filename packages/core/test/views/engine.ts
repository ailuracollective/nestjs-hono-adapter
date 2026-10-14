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

/** An engine small enough to read: it fills one placeholder. */
const engine: ViewEngine = (source, data) =>
  source.replace('{{name}}', String(data.name));

export { ENGINE, FIXTURES, engine };
