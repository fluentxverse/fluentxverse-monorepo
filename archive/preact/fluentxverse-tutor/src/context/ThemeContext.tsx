import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme-storage';

interface ThemeState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  syncSystemTheme: () => void;
  hydrateTheme: () => void;
}

interface PersistedThemeSnapshot {
  themeMode?: unknown;
  isDarkMode?: unknown;
  state?: PersistedThemeSnapshot;
}

const DEFAULT_THEME_MODE: ThemeMode = 'system';

const normalizeThemeMode = (themeMode: unknown): ThemeMode => {
  if (themeMode === 'light' || themeMode === 'dark' || themeMode === 'system') {
    return themeMode;
  }

  return DEFAULT_THEME_MODE;
};

const getSystemResolvedTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveThemeMode = (themeMode: ThemeMode): ResolvedTheme => {
  return themeMode === 'system' ? getSystemResolvedTheme() : themeMode;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      const initialResolvedTheme = resolveThemeMode(DEFAULT_THEME_MODE);

      return {
        themeMode: DEFAULT_THEME_MODE,
        resolvedTheme: initialResolvedTheme,
        isDarkMode: initialResolvedTheme === 'dark',
        toggleTheme: () => {
          const nextTheme: ResolvedTheme = get().resolvedTheme === 'dark' ? 'light' : 'dark';
          set({
            themeMode: nextTheme,
            resolvedTheme: nextTheme,
            isDarkMode: nextTheme === 'dark',
          });
        },
        setThemeMode: (themeMode) => {
          const normalizedThemeMode = normalizeThemeMode(themeMode);
          const resolvedTheme = resolveThemeMode(normalizedThemeMode);
          set({
            themeMode: normalizedThemeMode,
            resolvedTheme,
            isDarkMode: resolvedTheme === 'dark',
          });
        },
        syncSystemTheme: () => {
          if (get().themeMode !== 'system') {
            return;
          }

          const resolvedTheme = resolveThemeMode('system');

          if (resolvedTheme !== get().resolvedTheme || get().isDarkMode !== (resolvedTheme === 'dark')) {
            set({
              resolvedTheme,
              isDarkMode: resolvedTheme === 'dark',
            });
          }
        },
        hydrateTheme: () => {
          const resolvedTheme = resolveThemeMode(get().themeMode);
          set({
            resolvedTheme,
            isDarkMode: resolvedTheme === 'dark',
          });
        },
      };
    },
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const rawSnapshot =
          typeof persistedState === 'object' && persistedState !== null
            ? (persistedState as PersistedThemeSnapshot)
            : {};
        const snapshot = rawSnapshot.state && typeof rawSnapshot.state === 'object' ? rawSnapshot.state : rawSnapshot;

        if (version < 2 && typeof snapshot.isDarkMode === 'boolean') {
          return {
            themeMode: snapshot.isDarkMode ? 'dark' : 'light',
          };
        }

        return {
          themeMode: normalizeThemeMode(snapshot.themeMode),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.hydrateTheme();
      },
    }
  )
);
