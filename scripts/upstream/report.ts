/**
 * The report of a failed canary: opens the compatibility issue for the release the suite failed
 * against.
 *
 * Run from the repository root: `bun scripts/upstream/report.ts`.
 */

interface Watched {
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
  /** Every package the canary watched, with the version it installed. */
  watched: Watched[];
  log: string;
  runUrl: string;
}

/** How the issue tracker is read and written: the `gh` command line. */
type Gh = (args: string[]) => string;

/** The environment the workflow runs the script in. */
type Environment = Record<string, string | undefined>;

const LABELS = ['type/bug', 'status/needs-review', 'meta/dependency'];

/** The file the body is written to: the issue tracker reads it from there. */
const ISSUE_FILE = '/tmp/upstream-issue.md';

/**
 * The packages the canary installs at the root: each one follows the watched package it moves with,
 * so the reproduction installs the versions the canary installed.
 */
const ROOT_PACKAGES: readonly (readonly [string, string])[] = [
  ['hono', 'hono'],
  ['@nestjs/common', '@nestjs/core'],
  ['@nestjs/core', '@nestjs/core'],
  ['@nestjs/websockets', '@nestjs/core'],
  ['@nestjs/platform-ws', '@nestjs/core'],
  ['@nestjs/platform-socket.io', '@nestjs/core'],
];

/** The packages the canary installs in the compatibility suite. */
const COMPATIBILITY_PACKAGES: readonly (readonly [string, string])[] = [
  ['@nestjs/common', '@nestjs/core'],
  ['@nestjs/core', '@nestjs/core'],
  ['@nestjs/websockets', '@nestjs/core'],
  ['@nestjs/microservices', '@nestjs/core'],
  ['@nestjs/testing', '@nestjs/core'],
];

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
const markerOf = (moved: Watched[]): string =>
  `<!-- upstream-watch: ${moved.map((entry) => `${entry.name}@${entry.to}`).join(',')} -->`;

const titleOf = (moved: Watched[]): string => {
  const names = moved.map((entry) => `${entry.name} ${entry.to}`).join(' and ');
  return `fix: ${names} ${moved.length === 1 ? 'fails' : 'fail'} the compatibility suite`;
};

/** The packages the canary watched: the versions the workflow set. */
const watchedFrom = (pairs: [string, string | undefined, string | undefined][]): Watched[] => {
  const watched: Watched[] = [];
  for (const [name, from, to] of pairs) {
    // A missing version is a name that drifted, not a package that stayed:
    // saying so beats reporting half of the release.
    if (from === undefined || to === undefined) {
      throw new Error(`The workflow did not set the versions of ${name}.`);
    }
    watched.push({ name, from, to });
  }
  return watched;
};

/** The packages the canary moved: the release under suspicion. */
const movedFrom = (watched: Watched[]): Watched[] =>
  watched.filter((entry) => entry.from !== entry.to);

/** The version the canary installed for a watched package. */
const installedOf = (watched: Watched[], name: string): string => {
  const entry = watched.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`The workflow did not set the versions of ${name}.`);
  }
  return entry.to;
};

/** The install of a group of packages, at the versions the canary installed. */
const installOf = (packages: readonly (readonly [string, string])[], watched: Watched[]): string =>
  `bun add --exact ${packages
    .map(([name, follows]) => `${name}@${installedOf(watched, follows)}`)
    .join(' ')}`;

/**
 * The commands that reproduce the canary: its own install, the tree laid out once more and the
 * suite. The install is the canary's, because a mixed tree is what the suite fails on.
 */
const reproductionOf = (watched: Watched[]): string[] => [
  installOf(ROOT_PACKAGES, watched),
  `(cd packages/compatibility && ${installOf(COMPATIBILITY_PACKAGES, watched)})`,
  'rm -rf node_modules packages/*/node_modules && bun install',
  'bun run typecheck && bun run test',
];

const buildBody = (report: Report): string => {
  const { watched, log, runUrl } = report;
  const moved = movedFrom(watched);
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
    ...reproductionOf(watched),
    '```',
    '',
    markerOf(moved),
    '',
  ].join('\n');
};

/** The issue tracker, read through the GitHub CLI. */
const ghCommand: Gh = (args) => {
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

const main = async (gh: Gh = ghCommand, environment: Environment = Bun.env): Promise<void> => {
  const watched = watchedFrom([
    ['hono', environment.WATCH_HONO_FROM, environment.WATCH_HONO_TO],
    ['@nestjs/core', environment.WATCH_NEST_FROM, environment.WATCH_NEST_TO],
  ]);
  const moved = movedFrom(watched);
  if (moved.length === 0) {
    throw new Error('No package was moved; there is nothing to report.');
  }

  const report: Report = {
    watched,
    log: await read('canary.log'),
    runUrl: environment.RUN_URL ?? '',
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
  await Bun.write(ISSUE_FILE, buildBody(report));
  gh([
    'issue',
    'create',
    '--title',
    title,
    '--body-file',
    ISSUE_FILE,
    ...LABELS.flatMap((label) => (declared.has(label) ? ['--label', label] : [])),
  ]);
  console.log(`Opened ${title}.`);
};

if (import.meta.main) {
  await main();
}

export {
  assertionsOf,
  buildBody,
  failuresOf,
  installedOf,
  main,
  markerOf,
  movedFrom,
  quote,
  reproductionOf,
  tallyOf,
  titleOf,
  watchedFrom,
  COMPATIBILITY_PACKAGES,
  ISSUE_FILE,
  ROOT_PACKAGES,
};
export type { Environment, Gh, Issue, Report, Watched };
