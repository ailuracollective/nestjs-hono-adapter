import { InvalidArgumentError } from 'commander';

import type { Target, Tool } from '#benchmarks/harness/config/index';
import { ALL_TARGETS, ALL_TOOLS } from '#benchmarks/harness/config/index';
import { scenarios } from '#benchmarks/harness/scenarios/scenarios';

/** Checks whether a string is a recognized server target. */
const isTarget = (value: string): value is Target => ALL_TARGETS.some((target) => target === value);

/** Checks whether a string is a recognized load tool. */
const isTool = (value: string): value is Tool => ALL_TOOLS.some((tool) => tool === value);

/** Splits a comma-separated list or returns the fallback array. */
const splitList = (raw: string | undefined, fallback: readonly string[]): string[] =>
  raw === undefined || raw === 'all'
    ? [...fallback]
    : raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

/** Validates and parses target CLI arguments. */
const parseTargets = (raw: string): Target[] => {
  const requested = splitList(raw, ALL_TARGETS);
  const invalid = requested.filter((target) => !isTarget(target));
  if (invalid.length > 0) {
    throw new InvalidArgumentError(`unknown target(s): ${invalid.join(', ')}`);
  }
  return requested.filter((target) => isTarget(target));
};

/** Validates and parses scenario CLI arguments. */
const parseScenarios = (raw: string): string[] => {
  const available = scenarios.map((scenario) => scenario.id);
  const requested = splitList(raw, available);
  const invalid = requested.filter((item) => !available.includes(item));
  if (invalid.length > 0) {
    throw new InvalidArgumentError(`unknown scenario(s): ${invalid.join(', ')}`);
  }
  return requested;
};

/** Validates and parses a positive number option. */
const parsePositiveNumber = (value: string, name: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`--${name} must be a non-negative number`);
  }
  return parsed;
};

/** Resolves tool name argument or 'both' keyword. */
const resolveTools = (raw: string): Tool[] => {
  if (raw === 'both') {
    return [...ALL_TOOLS];
  }
  if (isTool(raw)) {
    return [raw];
  }
  throw new InvalidArgumentError(`unknown tool: ${raw}`);
};

export { parsePositiveNumber, parseScenarios, parseTargets, resolveTools };
