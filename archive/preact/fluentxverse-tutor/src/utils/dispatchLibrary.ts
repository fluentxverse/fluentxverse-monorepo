export interface DispatchArticle {
  id: string;
  title: string;
  topic: string;
  category: string;
  postedDate?: string;
  createdAt: string;
  status?: string;
}

const calendarDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dispatchToday(now = new Date()): string {
  const parts = calendarDate.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

export function dispatchPostDate(article: DispatchArticle): string | null {
  const posted = article.postedDate?.trim();
  if (posted) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(posted)) {
      const date = new Date(`${posted}T00:00:00Z`);
      if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === posted) return posted;
    } else {
      const date = new Date(posted);
      if (Number.isFinite(date.getTime())) {
        if (posted.includes('T')) return dispatchToday(date);
        // Human-readable post dates represent a calendar day, not a UTC timestamp.
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    }
  }
  const created = new Date(article.createdAt);
  return Number.isFinite(created.getTime()) ? dispatchToday(created) : null;
}

export function publishedDispatchArticles(articles: DispatchArticle[], today: string) {
  return articles.filter(article => {
    const date = dispatchPostDate(article);
    return article.status === 'published' && date !== null && date <= today;
  }).sort((a, b) => dispatchPostDate(b)!.localeCompare(dispatchPostDate(a)!) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export function filterDispatchArchive(articles: DispatchArticle[], year: string, month: string, day: string) {
  return articles.filter(article => {
    const [articleYear, articleMonth, articleDay] = dispatchPostDate(article)?.split('-') || [];
    return (!year || articleYear === year) && (!month || articleMonth === month) && (!day || articleDay === day);
  });
}
