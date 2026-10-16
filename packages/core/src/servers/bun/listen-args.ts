type ListenCallback = (error?: unknown) => void;

const noDisposer = (): void => {
  // Nothing to release: Bun takes the handler at construction.
};

const hostnameOf = (hostnameOrCallback: string | (() => void) | undefined): string | undefined => {
  if (typeof hostnameOrCallback === 'string') return hostnameOrCallback;
  return undefined;
};

const callbackOf = (
  hostnameOrCallback: string | (() => void) | undefined,
  callback: (() => void) | undefined,
): ListenCallback | undefined => {
  if (typeof hostnameOrCallback === 'function') return hostnameOrCallback;
  return callback;
};

export { callbackOf, hostnameOf, noDisposer };
export type { ListenCallback };
