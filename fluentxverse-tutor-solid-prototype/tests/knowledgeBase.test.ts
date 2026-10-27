import { expect, test } from 'bun:test';
import { knowledgeArticles, knowledgeCategories, parseKnowledgeBookmarks, searchKnowledge } from '../tutor/content/knowledgeBase';

test('knowledge articles have stable unique links and valid categories and sections', () => {
  expect(new Set(knowledgeArticles.map(article => article.slug)).size).toBe(knowledgeArticles.length);
  for (const article of knowledgeArticles) {
    expect(article.slug).toMatch(/^[a-z0-9-]+$/);
    expect(knowledgeCategories.some(category => category.id === article.category)).toBe(true);
    expect(article.sections.length).toBeGreaterThanOrEqual(3);
    expect(new Set(article.sections.map(section => section.id)).size).toBe(article.sections.length);
    for (const link of article.links) expect(/^\/(?!\/)|^mailto:support@fluentxverse\.com$/.test(link.href)).toBe(true);
  }
});
test('search covers titles, tags and body, ignores case, and requires all query terms', () => {
  expect(searchKnowledge('  CAMERA  ')[0].slug).toBe('camera-microphone-and-connection');
  expect(searchKnowledge('TA-302').some(article => article.slug === 'confirm-availability-and-attendance')).toBe(true);
  expect(searchKnowledge('48 hours').some(article => article.slug === 'write-and-submit-lesson-notes')).toBe(true);
  expect(searchKnowledge('doesnotexist camera')).toEqual([]);
  expect(searchKnowledge('')).toHaveLength(knowledgeArticles.length);
});
test('category and saved filters combine with search without changing the source catalog', () => {
  const before = JSON.stringify(knowledgeArticles);
  expect(searchKnowledge('', 'classroom').every(article => article.category === 'classroom')).toBe(true);
  expect(searchKnowledge('camera', 'teaching')).toEqual([]);
  expect(searchKnowledge('', 'all', [])).toEqual([]);
  expect(searchKnowledge('', 'all', ['join-your-classroom']).map(article => article.slug)).toEqual(['join-your-classroom']);
  expect(JSON.stringify(knowledgeArticles)).toBe(before);
});
test('saved article parsing tolerates invalid storage and drops stale or duplicate ids', () => {
  for (const raw of [null, 'invalid', '{}', 'null', '42']) expect(parseKnowledgeBookmarks(raw)).toEqual([]);
  expect(parseKnowledgeBookmarks('["join-your-classroom","join-your-classroom",null,"missing"]')).toEqual(['join-your-classroom']);
});
