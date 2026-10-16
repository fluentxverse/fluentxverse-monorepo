import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../tutor');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const names = { srcSet: 'srcset', fetchPriority: 'fetchpriority', strokeWidth: 'stroke-width', strokeDasharray: 'stroke-dasharray', strokeDashoffset: 'stroke-dashoffset', strokeLinecap: 'stroke-linecap', stopColor: 'stop-color' };
for (const file of walk(root).filter(file => file.endsWith('.tsx'))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const result = ts.transform(source, [context => {
    const visit = node => {
      if (ts.isJsxAttribute(node)) {
        const tag = node.parent.parent.tagName?.getText(source) || '';
        if (/^[a-z]/.test(tag) && names[node.name.text]) return ts.factory.updateJsxAttribute(node, ts.factory.createIdentifier(names[node.name.text]), ts.visitNode(node.initializer, visit));
        if (tag === 'TutorIcon' && node.name.text === 'style' && ts.isJsxExpression(node.initializer) && !ts.isCallExpression(node.initializer.expression)) return ts.factory.updateJsxAttribute(node, node.name, ts.factory.createJsxExpression(undefined, ts.factory.createCallExpression(ts.factory.createIdentifier('cssStyle'), undefined, [node.initializer.expression])));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  fs.writeFileSync(file, ts.createPrinter().printFile(result.transformed[0]));
  result.dispose();
}
