import { useEffect, useState } from 'preact/hooks';

export function getEmbeddedTheme(): 'light' | 'dark' | null {
  try {
    if (typeof window === 'undefined' || window.self === window.top) return null;
    const theme = window.parent.document.documentElement.dataset.theme;
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    return null;
  }
}

export function useEmbeddedTheme() {
  const [theme, setTheme] = useState(getEmbeddedTheme);
  useEffect(() => {
    if (getEmbeddedTheme() === null) return;
    const observer = new MutationObserver(() => setTheme(getEmbeddedTheme()));
    observer.observe(window.parent.document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
