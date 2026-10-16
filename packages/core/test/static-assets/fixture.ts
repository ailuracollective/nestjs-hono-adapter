import path from 'node:path';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures', 'public');

const INDEX = 'home.txt';

const WEEK_IN_MS = 604_800_000;

const WEEK_HEADER = 'public, max-age=604800';

export { FIXTURES, INDEX, WEEK_HEADER, WEEK_IN_MS };
