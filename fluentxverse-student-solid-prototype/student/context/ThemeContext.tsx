import { createSignal } from 'solid-js';

interface ThemeState {
  isDarkMode: boolean;
  resolvedTheme: 'dark' | 'light';
  toggleTheme: () => void;
  setDarkMode: (dark: boolean) => void;
}
const initialTheme = () => {
  try { return Boolean(JSON.parse(localStorage.getItem('theme-storage') || 'null')?.state?.isDarkMode); }
  catch { return false; }
};
const [dark, setDark] = createSignal(initialTheme());
const setDarkMode = (value: boolean) => {
  setDark(value);
  try { localStorage.setItem('theme-storage', JSON.stringify({ state: { isDarkMode: value }, version: 2 })); }
  catch { /* A blocked storage policy must not prevent theme changes. */ }
};
const state: ThemeState = {
  get isDarkMode() { return dark(); },
  get resolvedTheme() { return dark() ? 'dark' : 'light'; },
  toggleTheme: () => setDarkMode(!dark()),
  setDarkMode,
};
export function useThemeStore(): ThemeState;
export function useThemeStore<T>(selector: (state: ThemeState) => T): T;
export function useThemeStore<T>(selector?: (state: ThemeState) => T) {
  return selector ? selector(state) : state;
}
