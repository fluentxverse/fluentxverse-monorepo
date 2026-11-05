import { describe, expect, test } from 'bun:test';
import { parseDispatchSource } from '../../shared/dispatchSources';

describe('Daily Dispatch source citations', () => {
  test('turns the legacy Google News URL dump into compact reference links', () => {
    const first = 'https://news.google.com/rss/articles/' + 'a'.repeat(900) + '?oc=5';
    const second = 'https://news.google.com/rss/articles/second?oc=5';
    const parsed = parseDispatchSource(`This article was adapted from sources including NBC Sports and Olympics. Source URLs: ${first}, ${second}.`);
    expect(parsed.description).toBe('This article was adapted from sources including NBC Sports and Olympics.');
    expect(parsed.links).toEqual([{ href: first, label: 'Reference 1' }, { href: second, label: 'Reference 2' }]);
  });

  test('preserves explicit Markdown labels and resolves publisher names', () => {
    expect(parseDispatchSource('[Original report](https://www.nbcsports.com/news/story) https://olympics.com/news/story').links).toEqual([
      { href: 'https://www.nbcsports.com/news/story', label: 'Original report' },
      { href: 'https://olympics.com/news/story', label: 'Olympics' },
    ]);
    expect(parseDispatchSource('Adapted from news reports. Source URLs: https://example.com/a, [Olympics](https://olympics.com/news/story).').description).toBe('Adapted from news reports.');
  });

  test('deduplicates URLs and never uses the URL as its visible label', () => {
    expect(parseDispatchSource('https://example.com/story, [https://example.com/story](https://example.com/story)').links).toEqual([
      { href: 'https://example.com/story', label: 'example.com' },
    ]);
  });

  test('preserves URL query strings and balanced parentheses', () => {
    expect(parseDispatchSource('(https://example.com/story_(news)?a=1&b=two).').links[0].href).toBe('https://example.com/story_(news)?a=1&b=two');
  });

  test('keeps plain credit, handles empty fields, and removes duplicate wrappers', () => {
    expect(parseDispatchSource('This article was provided by Reuters.')).toEqual({ description: 'Reuters.', links: [] });
    expect(parseDispatchSource('Source: Reuters')).toEqual({ description: 'Reuters', links: [] });
    expect(parseDispatchSource(null)).toEqual({ description: '', links: [] });
  });

  test('does not create unsafe links or interpret source HTML', () => {
    const result = parseDispatchSource('[Bad](javascript:alert(1)) <script>alert(1)</script> https://user:pass@example.com/story');
    expect(result.links).toEqual([]);
    expect(result.description).toContain('<script>');
  });
});
