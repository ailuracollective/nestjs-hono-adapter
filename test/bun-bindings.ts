import type { Bindings } from '#adapter/core/ports/bindings';

const SYNTHETIC_SERVER = {
  hostname: undefined,
  port: undefined,
  protocol: 'http',
  // oxlint-disable-next-line unicorn/no-null
  requestIP: (): null => null,
  stop: (): Promise<void> => Promise.resolve(),
  upgrade: (): boolean => false,
} satisfies Bindings['server'];

export { SYNTHETIC_SERVER };
