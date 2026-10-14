/** One HTTP server implementation target under test. */
type Target = 'bun' | 'node' | 'express' | 'fastify';

/** A load generator tool the harness can drive. */
type Tool = 'oha' | 'bombardier';

/** One request pattern every target answers identically. */
interface Scenario {
  /** Unique scenario identifier. */
  readonly id: string;
  /** HTTP request method. */
  readonly method: string;
  /** URL path to request. */
  readonly path: string;
  /** Optional request body payload. */
  readonly body?: string;
  /** Optional Content-Type header. */
  readonly contentType?: string;
  /** Optional key-value request headers. */
  readonly headers?: Readonly<Record<string, string>>;
}

/** Environment metadata recorded beside benchmark results. */
interface RunMeta {
  /** Bun version string. */
  readonly bun: string;
  /** Concurrent connections count. */
  readonly connections: number;
  /** Number of logical CPU cores. */
  readonly cores: number;
  /** CPU model name. */
  readonly cpu: string;
  /** Measurement ISO timestamp. */
  readonly date: string;
  /** Measured seconds per run. */
  readonly durationSeconds: number;
  /** Node.js version string. */
  readonly node: string;
  /** Number of runs per scenario. */
  readonly runs: number;
  /** Installed versions of load tools. */
  readonly tools: Readonly<Record<string, string>>;
  /** Warmup seconds per scenario. */
  readonly warmupSeconds: number;
}

/** Parsed benchmark command line options. */
interface Options {
  /** Concurrent connections count. */
  readonly connections: number;
  /** Measured seconds per run. */
  readonly durationSeconds: number;
  /** Measured runs per scenario. */
  readonly runs: number;
  /** Scenarios to execute. */
  readonly scenarioIds: readonly string[];
  /** Server targets to test. */
  readonly targets: readonly Target[];
  /** Load tools to use. */
  readonly tools: readonly Tool[];
  /** Warmup seconds before measurement. */
  readonly warmupSeconds: number;
}

export type { Options, RunMeta, Scenario, Target, Tool };
