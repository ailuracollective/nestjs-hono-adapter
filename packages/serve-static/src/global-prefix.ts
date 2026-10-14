/**
 * The deployment's global prefix. `getGlobalPrefix` is Nest's
 * own and reads `this`.
 */
const globalPrefixOf = (config: {
  getGlobalPrefix?: () => string | undefined;
}): string | undefined =>
  config.getGlobalPrefix === undefined
    ? undefined
    : config.getGlobalPrefix();

export { globalPrefixOf };
