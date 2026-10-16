import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const file = path.resolve(import.meta.dirname, '../tutor/Components/LearningNotesFields.tsx');
const program = ts.createProgram([file], { jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler });
const checker = program.getTypeChecker(), source = program.getSourceFile(file), f = ts.factory;
const accessors = new Set();
const result = ts.transform(source, [context => {
  const visit = node => {
    if (ts.isIdentifier(node) && accessors.has(checker.getSymbolAtLocation(node)) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !(ts.isParameter(node.parent) && node.parent.name === node)) return f.createCallExpression(node, undefined, []);
    if (ts.isJsxExpression(node) && node.expression && ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'map') {
      const callback = node.expression.arguments[0];
      if (ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) {
        const first = callback.parameters[0];
        const symbol = first && checker.getSymbolAtLocation(first.name);
        if (symbol) accessors.add(symbol);
        const child = ts.visitNode(callback, visit);
        if (symbol) accessors.delete(symbol);
        const each = ts.visitNode(node.expression.expression.expression, visit);
        return f.createJsxExpression(undefined, f.createJsxElement(f.createJsxOpeningElement(f.createIdentifier('Index'), undefined, f.createJsxAttributes([f.createJsxAttribute(f.createIdentifier('each'), f.createJsxExpression(undefined, each))])), [f.createJsxExpression(undefined, child)], f.createJsxClosingElement(f.createIdentifier('Index'))));
      }
    }
    return ts.visitEachChild(node, visit, context);
  };
  return node => f.updateSourceFile(ts.visitNode(node, visit), [f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([f.createImportSpecifier(false, undefined, f.createIdentifier('Index'))])), f.createStringLiteral('solid-js')), ...ts.visitNode(node, visit).statements]);
}]);
fs.writeFileSync(file, ts.createPrinter().printFile(result.transformed[0]));
result.dispose();
