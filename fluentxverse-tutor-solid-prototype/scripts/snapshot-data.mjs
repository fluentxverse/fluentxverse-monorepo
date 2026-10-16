import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../tutor');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
// State updates and memo results own snapshots, not getters into a later selection.
for (const file of walk(root).filter(file => /\.[tj]sx?$/.test(file))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), 99, true, file.endsWith('tsx') ? 4 : 3);
  const snapshot = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression)) {
        if (/^set[A-Z]/.test(parent.expression.text) || parent.expression.text === 'createMemo') return true;
        if (/^use[A-Z]/.test(parent.expression.text)) return false;
      }
      if (ts.isJsxAttribute(parent)) return false;
    }
    return false;
  };
  const result = ts.transform(source, [context => {
    const visit = node => {
      if (ts.isObjectLiteralExpression(node) && snapshot(node)) return ts.factory.updateObjectLiteralExpression(node, node.properties.map(property => {
        if (ts.isGetAccessor(property) && property.body?.statements.length === 1 && ts.isReturnStatement(property.body.statements[0])) return ts.factory.createPropertyAssignment(property.name, ts.visitNode(property.body.statements[0].expression, visit));
        return ts.visitNode(property, visit);
      }));
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  fs.writeFileSync(file, ts.createPrinter().printFile(result.transformed[0]));
  result.dispose();
}
