import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { materialFrameUrl as tutorFrameUrl } from '../src/utils/materialFrameUrl';
import { materialFrameUrl as studentFrameUrl } from '../../fluentxverse-student/src/utils/materialFrameUrl';

for (const app of ['tutor', 'student']) {
  const html = readFileSync(new URL(`../../fluentxverse-${app}/index.html`, import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  function bootstrap(storedDark: boolean, parentTheme?: string, inaccessibleParent = false) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, classList: { toggle() {} } };
    const window: any = { location: { pathname: '/materials/daily-dispatch/test' }, matchMedia: () => ({ matches: false }) };
    window.self = window;
    window.top = parentTheme ? {} : window;
    window.parent = inaccessibleParent
      ? { get document() { throw new Error('Cross-origin'); } }
      : { document: { documentElement: { dataset: { theme: parentTheme } } } };
    const storage = { getItem: (key: string) => key === 'theme-storage' ? JSON.stringify({ state: { themeMode: storedDark ? 'dark' : 'light', isDarkMode: storedDark }, version: 2 }) : null };
    runInNewContext(script, { window, document: { documentElement: root, querySelector: () => null }, localStorage: storage, sessionStorage: storage });
    return root;
  }
  test(`${app}: dark material canvas is set before app code runs`, () => {
    const root = bootstrap(true);
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.materialPage).toBe('true');
    expect(root.style.colorScheme).toBe('dark');
    expect(html).toContain("html[data-material-page='true'][data-theme='dark'] body{background:#1a1a1a!important");
  });
  test(`${app}: frames inherit the parent instead of a conflicting saved theme`, () => {
    expect(bootstrap(false, 'dark').dataset.theme).toBe('dark');
    expect(bootstrap(true, 'light').dataset.theme).toBe('light');
  });
  test(`${app}: inaccessible parent uses the app theme`, () => {
    expect(bootstrap(true, 'dark', true).dataset.theme).toBe('dark');
    expect(bootstrap(false, 'dark', true).dataset.theme).toBe('light');
  });
}

for (const [app, frameUrl] of [['tutor', tutorFrameUrl], ['student', studentFrameUrl]] as const) {
  test(`${app}: remote previews receive the theme without losing existing URL state`, () => {
    const url = new URL(frameUrl('https://admin.example/business-english-preview/lesson?layout=2&theme=light#practice', 'dark', 'https://app.example'));
    expect(url.searchParams.get('theme')).toBe('dark');
    expect(url.searchParams.get('layout')).toBe('2');
    expect(url.hash).toBe('#practice');
    expect(frameUrl('/materials/daily-dispatch/article', 'dark', 'https://app.example')).toBe('/materials/daily-dispatch/article');
  });
}
