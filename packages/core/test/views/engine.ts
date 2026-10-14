import path from 'node:path';

import type { ViewEngine } from '#adapter/index';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'views');

const ENGINE = 'tpl';

const engine: ViewEngine = (source, data) => source.replace('{{name}}', String(data.name));

export { ENGINE, FIXTURES, engine };
