import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { learningCategoryLabel } from '../../shared/learningTerminology';

const root = path.resolve(import.meta.dir, '../..');
const isStandaloneSite = existsSync(path.join(root, 'SOURCE.json'))
  && JSON.parse(readFileSync(path.join(root, 'SOURCE.json'), 'utf8')).app === 'fluentxverse-site';
const sourceRoots = isStandaloneSite ? ['fluentxverse-site/src', 'shared'] : [
  'fluentxverse-site/src',
  'fluentxverse-student-solid-prototype/student',
  'fluentxverse-tutor-solid-prototype/tutor',
  'fluentxverse-dashboard/src',
  'shared',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}

describe('learning terminology', () => {
  test('current app copy does not use the former brand narrative', () => {
    const obsolete = /\b(?:onchain education|education (?:applications?|apps?|ecosystem|platform|projects?)|AI in education|online education|language education|ESL education)\b/i;
    const violations: string[] = [];
    for (const file of sourceRoots.flatMap(directory => sourceFiles(path.join(root, directory)))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && obsolete.test(node.text)) {
          violations.push(`${path.relative(root, file)}: ${node.text.trim()}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(violations).toEqual([]);
  });

  test('legacy article category values keep working with new display labels', () => {
    const article = { category: 'Education' };
    expect(learningCategoryLabel(article.category)).toBe('Learning');
    expect(article.category).toBe('Education');
    for (const category of ['Learning', 'Technology', 'All', 'Uncategorized', '']) {
      expect(learningCategoryLabel(category)).toBe(category);
    }
  });

  test('website metadata and internal links use the canonical learning route', () => {
    const app = readFileSync(path.join(root, 'fluentxverse-site/src/App.tsx'), 'utf8');
    expect(app).toContain('Why Onchain Learning | FluentXVerse');
    expect(app).toContain('<Route path="/onchain-learning" component={OnchainPage} />');
    expect(app).toContain('<Route path="/onchain-education" component={LegacyOnchainPage} />');
    const redirects = readFileSync(path.join(root, 'fluentxverse-site/public/_redirects'), 'utf8');
    expect(redirects).toContain('/onchain-education /onchain-learning 301');
    expect(redirects).toContain('/onchain-education/ /onchain-learning 301');
    for (const file of sourceFiles(path.join(root, 'fluentxverse-site/src'))) {
      if (file.endsWith('/App.tsx')) continue;
      expect(readFileSync(file, 'utf8')).not.toContain('href="/onchain-education');
    }
    expect(readFileSync(path.join(root, 'fluentxverse-site/index.html'), 'utf8')).toContain('onchain learning applications');
  });
});
