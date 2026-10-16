import { useEffect } from 'preact/hooks';
import NotFound from '@/Components/NotFound/NotFound';

const NotFoundPage = () => {
  useEffect(() => {
    document.title = '404 Not Found | FluentXVerse';
  }, []);

  return <NotFound />;
};

export default NotFoundPage;
