import { batch } from 'solid-js';
import { createStore } from 'solid-js/store';
// Preserve the notification store's partial-update contract with Solid properties.
export function createLocalStore<T extends object>(initialize: (set: (value: Partial<T> | ((state: T) => Partial<T>)) => void, get: () => T) => T) {
    let state: T;
    let update: (value: Partial<T>) => void;
    const set = (value: Partial<T> | ((state: T) => Partial<T>)) => batch(() => update(typeof value === 'function' ? value(state) : value));
    const [store, setStore] = createStore(initialize(set, () => state));
    state = store;
    update = value => setStore(value as any);
    function useStore(): T;
    function useStore<R>(selector: (state: T) => R): R;
    function useStore<R>(selector?: (state: T) => R) { return selector ? selector(state) : state; }
    return Object.assign(useStore, { setState: set, getState: () => state });
}
