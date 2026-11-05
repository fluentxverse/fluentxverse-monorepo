import { useLayoutEffect, useRef } from 'preact/hooks';
import { useAdminTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config/api';
import { mountDispatchArticle, type DispatchView } from '../../../shared/ui/dispatchArticle';
import '../../../shared/ui/daily-dispatch-article.css';

export default function DispatchArticleMaterial({ id, view }: { id: string; view: DispatchView }) {
  const { theme } = useAdminTheme();
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof mountDispatchArticle>>();
  useLayoutEffect(() => {
    if (!host.current) return;
    renderer.current = mountDispatchArticle(host.current, {
      apiBase: API_BASE_URL,
      articleId: id,
      view,
      allowViewSwitch: true,
      theme,
      libraryURL: '/daily-dispatch',
      archiveURL: month => `/daily-dispatch/${view === 'student' ? 'student/' : ''}archives/${encodeURIComponent(month)}`,
    });
    return () => renderer.current?.destroy();
  }, [id, view]);
  useLayoutEffect(() => renderer.current?.setTheme(theme), [theme]);
  return <div ref={host} className="dispatch-material-host" />;
}
