import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const source = new URL('../fluentxverse-student-solid-prototype/student/pages/ClassroomPage.css', import.meta.url);
const target = new URL('../shared/ui/classroom-student-base.css', import.meta.url);
const root = postcss.parse(readFileSync(source, 'utf8'), { from: fileURLToPath(source) });
root.walkRules(rule => {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
    parent = parent.parent;
  }
  rule.selector = postcss.list.comma(rule.selector).map(selector => {
    if (selector.includes('.classroom-container')) return selector.replaceAll('.classroom-container', '.classroom-container.classroom-standardized');
    const theme = selector.match(/^(\[data-theme=[^\]]+\]|\.dark-mode)\s+/);
    return theme ? selector.replace(theme[0], `${theme[0]}.classroom-standardized `) : `.classroom-standardized ${selector}`;
  }).join(',\n');
});
writeFileSync(target, '/* Generated from the student classroom stylesheet by scripts/sync-classroom-styles.mjs. */\n' + root.toString());
