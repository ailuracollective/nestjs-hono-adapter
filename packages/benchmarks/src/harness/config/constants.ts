import type { Target, Tool } from './env.types.ts';

/** All HTTP server implementation targets under test. */
const ALL_TARGETS: readonly Target[] = ['bun', 'node', 'express', 'fastify'];

/** All supported load generators the harness can drive. */
const ALL_TOOLS: readonly Tool[] = ['oha', 'bombardier'];

/** Default load generator tool. */
const DEFAULT_TOOL: Tool = 'oha';

/** Default concurrent connection count. */
const DEFAULT_CONNECTIONS = 100;

/** Default measured run duration in seconds. */
const DEFAULT_DURATION = 5;

/** Default warmup duration in seconds. */
const DEFAULT_WARMUP = 3;

/** Default count of measured runs per scenario. */
const DEFAULT_RUNS = 3;

export {
  ALL_TARGETS,
  ALL_TOOLS,
  DEFAULT_CONNECTIONS,
  DEFAULT_DURATION,
  DEFAULT_RUNS,
  DEFAULT_TOOL,
  DEFAULT_WARMUP,
};
