import type { ArgumentsHost } from '@nestjs/common';

type Writer = (request: unknown, errors: unknown) => unknown;

interface RunArgs {
  readonly filter: object;
  readonly original: Writer;
  readonly exception: unknown;
  readonly host: ArgumentsHost;
}

interface ScopeArgs extends RunArgs {
  readonly options: object;
  readonly store: unknown;
  readonly write: Writer;
}

const isWriter = (value: unknown): value is Writer => typeof value === 'function';

const copyOptions = (options: object): Record<string, unknown> => {
  const copy: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key === 'string') copy[key] = Reflect.get(options, key);
  }
  return copy;
};

const writeOf = (
  options: object,
): { readonly store: unknown; readonly write: Writer } | undefined => {
  const store: unknown = Reflect.get(options, 'flashStore');
  if (typeof store !== 'object' || store === null) return undefined;
  const write: unknown = Reflect.get(store, 'write');
  return isWriter(write) ? { store, write } : undefined;
};

const scopedOptions = (args: {
  readonly options: object;
  readonly request: unknown;
  readonly store: unknown;
  readonly write: Writer;
}): Record<string, unknown> => {
  const scoped = copyOptions(args.options);
  scoped.flashStore = {
    write: (_request: unknown, errors: unknown): unknown => {
      const result: unknown = Reflect.apply(args.write, args.store, [args.request, errors]);
      return result;
    },
  };
  return scoped;
};

const run = (args: RunArgs): unknown => {
  const result: unknown = Reflect.apply(args.original, args.filter, [args.exception, args.host]);
  return result;
};

const runScoped = (args: ScopeArgs): unknown => {
  const request = args.host.switchToHttp().getRequest<unknown>();
  const scoped = scopedOptions({
    options: args.options,
    request,
    store: args.store,
    write: args.write,
  });
  if (!Reflect.set(args.filter, 'options', scoped)) return run(args);
  try {
    return run(args);
  } finally {
    Reflect.set(args.filter, 'options', args.options);
  }
};

export { isWriter, run, runScoped, writeOf };
export type { RunArgs, ScopeArgs, Writer };
