const requireAppName = (
  config: Record<string, unknown>,
): {
  APP_NAME: unknown;
} => {
  if (typeof config.APP_NAME !== 'string') throw new TypeError('APP_NAME was not loaded');
  return { APP_NAME: config.APP_NAME };
};
const nameOf = (config: unknown): string | undefined => {
  if (typeof config !== 'object' || config === null) return undefined;
  const name: unknown = Reflect.get(config, 'APP_NAME');
  if (typeof name !== 'string') return undefined;
  return name;
};

const APP_NAME_SCHEMA = {
  '~standard': {
    validate: (
      config: unknown,
    ): { value: unknown } | { issues: readonly { message: string }[] } => {
      const name = nameOf(config);
      if (name === undefined) {
        return {
          issues: [{ message: 'APP_NAME was not loaded' }],
        };
      }
      return { value: { APP_NAME: name } };
    },
    vendor: 'nestjs-hono-adapter',
    version: 1 as const,
  },
};

export { APP_NAME_SCHEMA, nameOf, requireAppName };
