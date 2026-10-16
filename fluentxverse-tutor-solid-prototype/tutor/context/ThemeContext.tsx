import { createSignal, batch } from 'solid-js';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'theme-storage';
const normalize = (value: unknown): ThemeMode => value === 'light' || value === 'dark' ? value : 'system';
const systemTheme = (): ResolvedTheme => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const resolve = (mode: ThemeMode) => mode === 'system' ? systemTheme() : mode;
const initial = (): ThemeMode => {
    try {
        const raw = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || 'null');
        const saved = raw?.state || raw;
        return saved?.themeMode ? normalize(saved.themeMode) : typeof saved?.isDarkMode === 'boolean' ? (saved.isDarkMode ? 'dark' : 'light') : 'system';
    }
    catch {
        return 'system';
    }
};
const [mode, setMode] = createSignal<ThemeMode>(initial());
const [resolved, setResolved] = createSignal<ResolvedTheme>(resolve(mode()));
const setThemeMode = (value: ThemeMode) => {
    batch(() => { setMode(normalize(value)); setResolved(resolve(mode())); });
    try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: { themeMode: mode() }, version: 2 }));
    }
    catch { }
};
const state = {
    get themeMode() { return mode(); },
    get resolvedTheme() { return resolved(); },
    get isDarkMode() { return resolved() === 'dark'; },
    setThemeMode,
    toggleTheme: () => setThemeMode(resolved() === 'dark' ? 'light' : 'dark'),
    syncSystemTheme: () => {
        if (mode() === 'system')
            setResolved(systemTheme());
    },
    hydrateTheme: () => setResolved(resolve(mode())),
};
type ThemeState = typeof state;
export function useThemeStore(): ThemeState;
export function useThemeStore<T>(selector: (value: ThemeState) => T): T;
export function useThemeStore<T>(selector?: (value: ThemeState) => T) { return selector ? selector(state) : state; }
