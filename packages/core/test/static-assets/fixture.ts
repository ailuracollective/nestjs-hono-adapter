import path from 'node:path';

/** The files the static asset cases serve. */
const FIXTURES = path.join(
  import.meta.dirname,
  '..',
  'fixtures',
  'public',
);

/** The name the directory index is configured with. */
const INDEX = 'home.txt';

/** A week in milliseconds, as the option is written. */
const WEEK_IN_MS = 604_800_000;

/** The max-age header a week is sent as. */
const WEEK_HEADER = 'public, max-age=604800';

export { FIXTURES, INDEX, WEEK_HEADER, WEEK_IN_MS };
