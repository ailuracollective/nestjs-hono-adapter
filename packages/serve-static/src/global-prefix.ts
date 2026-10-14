const globalPrefixOf = (config: {
  getGlobalPrefix?: () => string | undefined;
}): string | undefined =>
  config.getGlobalPrefix === undefined ? undefined : config.getGlobalPrefix();

export { globalPrefixOf };
