import type { Scenario } from '#benchmarks/harness/config/index';

/** Default Content-Type header when a body is provided. */
const BODY_JSON = 'application/json';

/** Options required to construct load generator CLI arguments. */
interface ToolOptions {
  /** Concurrent connections count. */
  readonly connections: number;
  /** Duration in seconds. */
  readonly durationSeconds: number;
  /** Target request scenario. */
  readonly scenario: Scenario;
  /** Full destination URL. */
  readonly url: string;
}

/** Builds command-line arguments for the oha load generator. */
const ohaArgs = (options: ToolOptions): string[] => {
  const { connections, durationSeconds, scenario, url } =
    options;
  const headers = Object.entries(
    scenario.headers ?? {},
  ).flatMap(([name, value]) => ['-H', `${name}: ${value}`]);
  const requestBody = scenario.body;
  const body =
    requestBody === undefined
      ? []
      : [
          '-T',
          scenario.contentType ?? BODY_JSON,
          '-d',
          requestBody,
        ];
  return [
    '-z',
    `${durationSeconds}s`,
    '-c',
    String(connections),
    '--no-tui',
    '--output-format',
    'json',
    '-m',
    scenario.method,
    ...body,
    ...headers,
    url,
  ];
};

/** Constructs header flags for the bombardier load generator. */
const bombardierHeaders = (scenario: Scenario): string[] => {
  const declared = Object.entries(scenario.headers ?? {});
  const withType =
    scenario.body === undefined
      ? declared
      : [
          ['Content-Type', scenario.contentType ?? BODY_JSON],
          ...declared,
        ];
  return withType.flatMap(([name, value]) => [
    '-H',
    `${name}: ${value}`,
  ]);
};

/**
 * Builds command-line arguments for the bombardier load
 * generator.
 */
const bombardierArgs = (options: ToolOptions): string[] => {
  const { connections, durationSeconds, scenario, url } =
    options;
  const body =
    scenario.body === undefined ? [] : ['-b', scenario.body];
  return [
    '-c',
    String(connections),
    '-d',
    `${durationSeconds}s`,
    '-l',
    '-p',
    'r',
    '--fasthttp',
    '-o',
    'json',
    '-m',
    scenario.method,
    ...body,
    ...bombardierHeaders(scenario),
    url,
  ];
};

export type { ToolOptions };
export { bombardierArgs, ohaArgs };
