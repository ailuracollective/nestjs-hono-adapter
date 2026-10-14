/** The callback Nest passes alongside the port. */
type ListenCallback = (error?: unknown) => void;

/** Says a websocket handler is already installed on the server. */
const noDisposer = (): void => {
  // Nothing to release: Bun takes the handler at construction.
};

/** The hostname Nest's listen arguments name. */
const hostnameOf = (
  hostnameOrCallback: string | (() => void) | undefined,
): string | undefined => {
  if (typeof hostnameOrCallback === 'string') {
    return hostnameOrCallback;
  }
  return undefined;
};

/** The callback Nest's listen arguments name. */
const callbackOf = (
  hostnameOrCallback: string | (() => void) | undefined,
  callback: (() => void) | undefined,
): ListenCallback | undefined => {
  if (typeof hostnameOrCallback === 'function') {
    return hostnameOrCallback;
  }
  return callback;
};

export { callbackOf, hostnameOf, noDisposer };
export type { ListenCallback };
