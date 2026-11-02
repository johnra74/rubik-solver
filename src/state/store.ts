/** Tiny observable store. */
export interface Store<T> {
  getState(): T;
  setState(update: Partial<T> | ((s: T) => T)): void;
  subscribe(fn: (s: T, prev: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<(s: T, prev: T) => void>();
  return {
    getState: () => state,
    setState(update) {
      const next = typeof update === 'function' ? update(state) : { ...state, ...update };
      if (next === state) return;
      const keys = new Set([...Object.keys(state), ...Object.keys(next)]) as Set<keyof T>;
      let changed = false;
      for (const k of keys) if (state[k] !== next[k]) changed = true;
      if (!changed) return;
      const prev = state;
      state = next;
      subs.forEach((fn) => fn(state, prev));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
