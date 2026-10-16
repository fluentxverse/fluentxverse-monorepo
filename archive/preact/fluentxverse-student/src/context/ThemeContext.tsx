import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedTheme = window.localStorage.getItem('theme-storage');
    if (!storedTheme) {
      return false;
    }

    const parsedTheme = JSON.parse(storedTheme);
    return Boolean(parsedTheme?.state?.isDarkMode);
  } catch {
    return false;
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDarkMode: getInitialDarkMode(),
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setDarkMode: (isDark: boolean) => set(() => ({ isDarkMode: isDark })),
    }),
    {
      name: 'theme-storage', // Unique name for localStorage
    }
  )
);
