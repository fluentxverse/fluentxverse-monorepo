import { createEffect, createMemo, onCleanup, onMount, untrack } from 'solid-js';
import { useRoute } from '../routing';
import { API_BASE_URL } from '../config/api';
import { useThemeStore } from '../context/ThemeContext';
import { mountDispatchArticle } from '../../../shared/ui/dispatchArticle';
import './DailyDispatchArticlePage.css';

export default function DailyDispatchArticlePage() {
  const route = useRoute();
  const theme = createMemo(() => useThemeStore(state => state.resolvedTheme));
  let host!: HTMLDivElement;
  let renderer: ReturnType<typeof mountDispatchArticle> | undefined;
  onMount(() => {
    createEffect(() => {
      const id = route.params?.id || '';
      renderer?.destroy();
      renderer = mountDispatchArticle(host, {
        apiBase: API_BASE_URL,
        articleId: id,
        view: new URLSearchParams(window.location.search).get('mode') === 'student' ? 'student' : 'tutor',
        allowViewSwitch: true,
        theme: untrack(theme),
        libraryURL: '/materials/daily-dispatch',
        archiveURL: month => `/materials/daily-dispatch/archives/${encodeURIComponent(month)}`,
      });
    });
    createEffect(() => renderer?.setTheme(theme()));
  });
  onCleanup(() => renderer?.destroy());
  return <div ref={host} class="dispatch-material-host" />;
}
