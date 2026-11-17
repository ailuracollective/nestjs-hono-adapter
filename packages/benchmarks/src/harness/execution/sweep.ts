/* eslint-disable no-await-in-loop -- sequential scenario measurements. */

import type {
  App,
  LoadResult,
  Options,
  Sample,
  Scenario,
  Target,
  Tool,
} from '#benchmarks/harness/config/index';
import { measure } from '#benchmarks/harness/tools/load';
import { sampleResources, toResourceUsage } from './resources/index.ts';

/** One running application variant under test. */
interface ServerHandle {
  /** OS process id of the server, when known. */
  readonly pid: number | undefined;
  /** Port the server is listening on. */
  readonly port: number;
}

/** Configuration and measurement handle for a target sweep. */
interface Sweep {
  /** Function returning a load measurement promise. */
  readonly measure: (scenario: Scenario, tool: Tool) => (seconds: number) => Promise<LoadResult>;
  /** Options guiding the execution. */
  readonly options: Options;
  /** Running server per application variant. */
  readonly servers: ReadonlyMap<App, ServerHandle>;
  /** Scenarios selected to run. */
  readonly selected: readonly Scenario[];
  /** Server target under test. */
  readonly target: Target;
}

/** Specification required to initialize a sweep. */
interface SweepSpec {
  /** Execution options. */
  readonly options: Options;
  /** Running server per application variant. */
  readonly servers: ReadonlyMap<App, ServerHandle>;
  /** Scenarios to measure. */
  readonly selected: readonly Scenario[];
  /** Target under test. */
  readonly target: Target;
}

/** Resolves the server a scenario runs against, failing loudly when it was not started. */
const serverFor = (servers: ReadonlyMap<App, ServerHandle>, app: App): ServerHandle => {
  const server = servers.get(app);
  if (server === undefined) {
    throw new Error(`the ${app} server was not started for the selected scenarios`);
  }
  return server;
};

/** Creates a Sweep execution context for a running target. */
const sweepFor = (spec: SweepSpec): Sweep => ({
  measure:
    (scenario, tool) =>
    (seconds: number): Promise<LoadResult> => {
      const server = serverFor(spec.servers, scenario.app);
      return measure({
        connections: spec.options.connections,
        durationSeconds: seconds,
        scenario,
        tool,
        url: `http://127.0.0.1:${server.port}${scenario.path}`,
      });
    },
  options: spec.options,
  selected: spec.selected,
  servers: spec.servers,
  target: spec.target,
});

/** Warms up and measures a single scenario with a tool. */
const runScenario = async (sweep: Sweep, scenario: Scenario, tool: Tool): Promise<Sample[]> => {
  const samples: Sample[] = [];
  const load = sweep.measure(scenario, tool);
  const { pid } = serverFor(sweep.servers, scenario.app);
  if (sweep.options.warmupSeconds > 0) {
    await load(sweep.options.warmupSeconds);
  }
  for (let index = 0; index < sweep.options.runs; index += 1) {
    const { result, usage } = await sampleResources(pid, () => load(sweep.options.durationSeconds));
    samples.push({
      resources: toResourceUsage(usage, result.total),
      result,
      run: index,
      scenario: scenario.id,
      target: sweep.target,
      tool,
    });
  }
  return samples;
};

/** Collects samples across all scenarios and tools for a sweep. */
const collect = async (sweep: Sweep): Promise<Sample[]> => {
  const samples: Sample[] = [];
  for (const scenario of sweep.selected) {
    for (const tool of sweep.options.tools) {
      const produced = await runScenario(sweep, scenario, tool);
      samples.push(...produced);
    }
  }
  return samples;
};

export { collect, sweepFor };
export type { ServerHandle };
