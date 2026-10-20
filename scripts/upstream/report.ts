/**
 * The report of a failed canary: opens the compatibility issue for the release the suite failed
 * against.
 *
 * Run from the repository root: `bun scripts/upstream/report.ts`.
 */

interface Moved {
  name: string;
  from: string;
  to: string;
}

interface Issue {
  number: number;
  title: string;
  body: string;
}

interface Report {
  moved: Moved[];
  log: string;
  runUrl: string;
}

const LABELS = ['type/bug', 'status/needs-review', 'meta/dependency'];

/**
 * The log is written by the upstream code, so it is quoted as text and never as markup: a fence or
 * a marker in it would end the block it sits in.
 */
const quote = (text: string): string =>
  text.replaceAll('```', "'''").replaceAll('<!--', '&lt;!--').trim();

/** The failing tests, as the runner names them. */
const failuresOf = (log: string): string[] =>
  [...log.matchAll(/^\(fail\) (?<name>.+?) \[/gm)].map((match) => {
    const { groups } = match;
    return quote(groups === undefined ? '' : (groups.name ?? ''));
  });

/** The assertions that failed with them. */
const assertionsOf = (log: string): string[] =>
  log
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('error:') ||
        line.startsWith('Expected') ||
        line.startsWith('Received:') ||
        /^\s+at /.test(line),
    )
    .slice(0, 40)
    .map((line) => quote(line));

/** The tally the runner ends with. */
const tallyOf = (log: string): string =>
  log
    .split('\n')
    .filter((line) => /^\s*\d+ (?<tally>pass|fail|skip|todo)/.test(line))
    .join('\n');

/** The marker that tells one release's issue from another's. */
const markerOf = (moved: Moved[]): string =>
  `<!-- upstream-watch: ${moved.map((entry) => `${entry.name}@${entry.to}`).join(',')} -->`;

const titleOf = (moved: Moved[]): string => {
  const names = moved.map((entry) => `${entry.name} ${entry.to}`).join(' and ');
  return `fix: ${names} ${moved.length === 1 ? 'fails' : 'fail'} the compatibility suite`;
};

const buildBody = (report: Report): string => {
  const { moved, log, runUrl } = report;
  const names = moved.map((entry) => `${entry.name} ${entry.to}`).join(' and ');
  const failures = failuresOf(log);
  const assertions = assertionsOf(log);
  const tally = tallyOf(log);
  return [
    '## Context',
    '',
    `The nightly upstream watch runs the suite against the last available release of the watched packages, and the suite fails against it. The repository is on ${moved
      .map((entry) => `${entry.name} ${entry.from}`)
      .join(' and ')}, so the release is not taken yet.`,
    '',
    '## Goal',
    '',
    `The adapter serves an application built with ${names}, or the declared range is narrowed to the last release the adapter supports.`,
    '',
    '## Scope',
    '',
    `- The behaviour the adapter has against ${names}.`,
    '- The declared range of the package, when the release is not taken.',
    '',
    '## Acceptance criteria',
    '',
    `- [ ] The suite passes against ${names}.`,
    `- [ ] The declared range of ${moved.map((entry) => entry.name).join(' and ')} takes the last available release of the line, or names the last release the adapter supports.`,
    '',
    '## Non-goals',
    '',
    '- Support for a major the repository does not declare.',
    '',
    '## References',
    '',
    `- The failing run: ${runUrl}`,
    '- The watch: `.github/workflows/upstream.yml`',
    '',
    '## Observed behavior',
    '',
    failures.length > 0
      ? `The suite fails against ${names}:`
      : `The install or the suite fails against ${names} before any test runs:`,
    '',
    ...failures.map((name) => `- ${name}`),
    ...(assertions.length > 0 ? ['', '```', ...assertions, '```'] : []),
    ...(tally.length > 0 ? ['', tally] : []),
    '',
    '## Expected behavior',
    '',
    'The suite passes against the last available release of the line, as it does against the version the lockfile holds.',
    '',
    '## Reproduction',
    '',
    '```sh',
    `bun add --exact ${moved.map((entry) => `${entry.name}@${entry.to}`).join(' ')}`,
    'rm -rf node_modules packages/*/node_modules && bun install',
    'bun run typecheck && bun run test',
    '```',
    '',
    markerOf(moved),
    '',
  ].join('\n');
};

const gh = (args: string[]): string => {
  const result = Bun.spawnSync(['gh', ...args], {
    env: process.env,
  });
  const out = result.stdout.toString().trim();
  if (result.exitCode !== 0) {
    throw new Error(`gh ${args[0]} failed: ${result.stderr.toString().trim()}`);
  }
  return out;
};

const read = async (name: string): Promise<string> => {
  const file = Bun.file(name);
  return (await file.exists()) ? file.text() : '';
};

/** The packages the canary moved: the release under suspicion. */
const movedFrom = (pairs: [string, string | undefined, string | undefined][]): Moved[] => {
  const moved: Moved[] = [];
  for (const [name, from, to] of pairs) {
    // A missing version is a name that drifted, not a package that stayed:
    // saying so beats reporting half of the release.
    if (from === undefined || to === undefined) {
      throw new Error(`The workflow did not set the versions of ${name}.`);
    }
    if (from !== to) {
      moved.push({ name, from, to });
    }
  }
  return moved;
};

const main = async (): Promise<void> => {
  const moved = movedFrom([
    ['hono', Bun.env.WATCH_HONO_FROM, Bun.env.WATCH_HONO_TO],
    ['@nestjs/core', Bun.env.WATCH_NEST_FROM, Bun.env.WATCH_NEST_TO],
  ]);
  if (moved.length === 0) {
    throw new Error('No package was moved; there is nothing to report.');
  }

  const report: Report = {
    moved,
    log: await read('canary.log'),
    runUrl: Bun.env.RUN_URL ?? '',
  };

  // One issue per release: the marker in the body tells them apart.
  const open = JSON.parse(
    gh(['issue', 'list', '--state', 'open', '--json', 'number,title,body', '--limit', '100']),
  ) as Issue[];
  const existing = open.find((issue) => issue.body.includes(markerOf(moved)));
  if (existing !== undefined) {
    console.log(`Issue #${existing.number} already carries this release.`);
    return;
  }

  // A label the repository does not declare is dropped silently, so only the
  // ones the remote knows are named.
  const declared = new Set(
    (JSON.parse(gh(['label', 'list', '--json', 'name'])) as { name: string }[]).map(
      (label) => label.name,
    ),
  );
  const title = titleOf(moved);
  await Bun.write('/tmp/upstream-issue.md', buildBody(report));
  gh([
    'issue',
    'create',
    '--title',
    title,
    '--body-file',
    '/tmp/upstream-issue.md',
    ...LABELS.flatMap((label) => (declared.has(label) ? ['--label', label] : [])),
  ]);
  console.log(`Opened ${title}.`);
};

if (import.meta.main) {
  await main();
}

export { assertionsOf, buildBody, failuresOf, markerOf, movedFrom, quote, tallyOf, titleOf };
export type { Issue, Moved, Report };
