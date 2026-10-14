type Listener = (payload?: unknown) => void;

/**
 * The `on`/`off`/`once`/`emit` surface Nest reads a socket through: `fromEvent` finds `on` and
 * `off`, and `bindClientDisconnect` finds `once`.
 */
class Emitter {
  private readonly listeners = new Map<string, Set<Listener>>();

  public on(name: string, listener: Listener): this {
    const known = this.listeners.get(name) ?? new Set<Listener>();
    known.add(listener);
    this.listeners.set(name, known);
    return this;
  }

  public off(name: string, listener: Listener): this {
    const known = this.listeners.get(name);
    if (known !== undefined) known.delete(listener);
    return this;
  }

  public once(name: string, listener: Listener): this {
    const wrapper: Listener = (payload) => {
      this.off(name, wrapper);
      listener(payload);
    };
    return this.on(name, wrapper);
  }

  public emit(name: string, payload?: unknown): void {
    const known = this.listeners.get(name);
    if (known === undefined) return;
    for (const listener of known) {
      listener(payload);
    }
  }

  public listenerCount(name: string): number {
    const known = this.listeners.get(name);
    return known === undefined ? 0 : known.size;
  }
}

export { Emitter };
export type { Listener };
