import { describe, expect, test } from 'bun:test';
import { dispatchPostDate, dispatchToday, filterDispatchArchive, publishedDispatchArticles, type DispatchArticle } from '../src/utils/dispatchLibrary';

const article = (id: string, postedDate: string, extra: Partial<DispatchArticle> = {}): DispatchArticle => ({
  id, title: id, topic: 'News', category: 'Science', createdAt: '2026-09-01T00:00:00Z', postedDate, status: 'published', ...extra,
});

describe('classroom Daily Dispatch calendar', () => {
  test('today follows Philippine time across the UTC date boundary', () => {
    expect(dispatchToday(new Date('2026-10-04T15:59:00Z'))).toBe('2026-10-04');
    expect(dispatchToday(new Date('2026-10-04T16:00:00Z'))).toBe('2026-10-05');
  });
  test('post date takes priority over when the record was created', () => {
    expect(dispatchPostDate(article('today', '2026-10-05'))).toBe('2026-10-05');
    expect(dispatchPostDate(article('human-date', 'May 24, 2026'))).toBe('2026-05-24');
  });
  test('legacy dates fall back to createdAt in Philippine time', () => {
    expect(dispatchPostDate(article('legacy', '', { createdAt: '2026-10-04T16:15:00Z' }))).toBe('2026-10-05');
    expect(dispatchPostDate(article('bad', '2026-02-30', { createdAt: 'invalid' }))).toBeNull();
  });
  test('only published, nonfuture, dated articles are eligible', () => {
    const result = publishedDispatchArticles([
      article('old', '2026-09-30'), article('today', '2026-10-05'),
      article('future', '2026-10-06'), article('draft', '2026-10-05', { status: 'draft' }),
      article('invalid', '', { createdAt: 'invalid' }),
    ], '2026-10-05');
    expect(result.map(item => item.id)).toEqual(['today', 'old']);
  });
  test('an older newest article is not mistaken for today', () => {
    const result = publishedDispatchArticles([article('old', '2026-05-24')], '2026-10-05');
    expect(result.find(item => dispatchPostDate(item) === '2026-10-05')).toBeUndefined();
  });
  test('archive filters combine month, day, and year', () => {
    const articles = [article('match', '2026-04-03'), article('other-day', '2026-04-09'), article('other-year', '2025-04-03'), article('other-month', '2026-05-03')];
    expect(filterDispatchArchive(articles, '2026', '04', '03').map(item => item.id)).toEqual(['match']);
    expect(filterDispatchArchive(articles, '', '04', '03').map(item => item.id)).toEqual(['match', 'other-year']);
    expect(filterDispatchArchive(articles, '2026', '02', '')).toEqual([]);
    expect(filterDispatchArchive(articles, '', '', '')).toHaveLength(4);
  });
});
