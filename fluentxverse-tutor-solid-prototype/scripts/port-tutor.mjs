import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

// One-time, symbol-aware source migration. It never edits the original app.
const root = path.resolve(import.meta.dirname, '../../archive/preact/fluentxverse-tutor/src');
const target = path.resolve(import.meta.dirname, '../tutor');
if (fs.existsSync(path.join(target, 'App.tsx')) && !process.argv.includes('--overwrite')) throw new Error('The application has manual Solid refinements. This one-time converter requires --overwrite; review and reapply those refinements afterward.');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const files = walk(root).filter(file => /\.[tj]sx?$/.test(file));
const program = ts.createProgram(files, { target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.Preserve, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
const checker = program.getTypeChecker();
const f = ts.factory;
const id = name => f.createIdentifier(name);
const call = (name, args = [], types) => f.createCallExpression(typeof name === 'string' ? id(name) : name, types, args);
const arrow = body => f.createArrowFunction(undefined, undefined, [], undefined, undefined, body);
const sym = node => checker.getSymbolAtLocation(node);
const hookNames = new Set();
const globalHookParams = new Map();
const functionName = node => node.name?.text || (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name.text) || '';
const accessorParameter = parameter => ts.isIdentifier(parameter.name) && ((parameter.type && !ts.isFunctionTypeNode(parameter.type) && !ts.isTypeReferenceNode(parameter.type)) || ['socket', 'load', 'owner', 'enabled', 'sessionId'].includes(parameter.name.text));
for (const source of program.getSourceFiles().filter(source => source.fileName.startsWith(root))) {
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text.startsWith('use')) hookNames.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text.startsWith('use') && (ts.isArrowFunction(node.initializer ?? id('')) || ts.isFunctionExpression(node.initializer ?? id('')))) hookNames.add(node.name.text);
    if (ts.isFunctionLike(node) && node.body && functionName(node).startsWith('use')) globalHookParams.set(functionName(node), node.parameters.map(parameter => accessorParameter(parameter) ? 'accessor' : 'object'));
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const skip = new Set(['wouter.d.ts', 'context/ThemeContext.tsx', 'context/NotificationContext.tsx', 'Components/ErrorBoundary.tsx', 'Components/ProtectedRoute.tsx']);
fs.mkdirSync(target, { recursive: true });
for (const file of walk(root)) {
  const relative = path.relative(root, file);
  if (!/\.[tj]sx?$/.test(file) && !relative.endsWith('.map')) {
    fs.mkdirSync(path.dirname(path.join(target, relative)), { recursive: true });
    fs.copyFileSync(file, path.join(target, relative));
  }
}
let converted = 0;
for (const file of files) {
  const relative = path.relative(root, file);
  if (skip.has(relative)) continue;
  const source = program.getSourceFile(file);
  const replacements = new Map();
  const reactive = new Set();
  const signals = new Set();
  const refs = new Set();
  const parameterPlans = new Map();
  const destructures = new Map();
  const memoVariables = new Set();
  const hookParams = new Map(globalHookParams);
  const scalarHooks = new Set(['useCurrentTime', 'useEmbeddedTheme']);
  const icons = new Set(source.statements.filter(statement => ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'lucide-preact').flatMap(statement => statement.importClause.namedBindings.elements.map(specifier => specifier.name.text)));
  let serial = 0;
  const bind = (node, replacement, signal = false) => {
    const symbol = sym(node);
    if (!symbol) return;
    reactive.add(symbol);
    if (replacement) replacements.set(symbol, replacement);
    if (signal) signals.add(symbol);
  };
  const scan = node => {
    if (ts.isFunctionLike(node) && node.body) {
      const plans = [];
      const name = functionName(node);
      const params = [];
      for (const [index, parameter] of node.parameters.entries()) {
        if (ts.isObjectBindingPattern(parameter.name)) {
          const replacement = id(`_props${serial++}`);
          plans.push({ parameter, replacement });
          for (const element of parameter.name.elements) {
            if (!ts.isIdentifier(element.name) || element.dotDotDotToken) continue;
            const key = element.propertyName || element.name;
            let value = f.createElementAccessExpression(replacement, f.createStringLiteral(key.text));
            if (element.initializer) value = f.createConditionalExpression(f.createBinaryExpression(value, ts.SyntaxKind.EqualsEqualsEqualsToken, id('undefined')), undefined, element.initializer, undefined, value);
            bind(element.name, value);
          }
          params[index] = 'object';
        } else if (ts.isIdentifier(parameter.name) && name.startsWith('use') && hookNames.has(name) && name !== 'useThemeStore' && !name.endsWith('Context') && !name.endsWith('Integration') && !name.includes('Toast')) {
          if (parameter.type && !ts.isFunctionTypeNode(parameter.type) && !ts.isTypeReferenceNode(parameter.type)) {
            bind(parameter.name, call(parameter.name.text), true); plans.push({ parameter, accessor: true }); params[index] = 'accessor';
          } else if (['socket', 'load', 'owner', 'enabled', 'sessionId'].includes(parameter.name.text)) {
            bind(parameter.name, call(parameter.name.text), true); plans.push({ parameter, accessor: true }); params[index] = 'accessor';
          } else { bind(parameter.name); params[index] = 'object'; }
        } else if (ts.isIdentifier(parameter.name) && (parameter.name.text === 'props' || parameter.name.text === 'options')) bind(parameter.name);
      }
      if (plans.length) parameterPlans.set(node, plans);
      if (name.startsWith('use')) hookParams.set(name, params);
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = node.initializer;
      const called = ts.isCallExpression(init) && ts.isIdentifier(init.expression) ? init.expression.text : '';
      if (called === 'useState' && ts.isArrayBindingPattern(node.name)) bind(node.name.elements[0].name, call(node.name.elements[0].name.text), true);
      if (ts.isIdentifier(node.name) && ['useMemo', 'useCallback', 'useThemeStore', 'useNotificationStore', ...scalarHooks].includes(called)) bind(node.name, call(node.name.text), true);
      if (called === 'useRef' && ts.isIdentifier(node.name)) refs.add(sym(node.name));
      if (ts.isObjectBindingPattern(node.name) && /^use[A-Z]/.test(called)) {
        const temp = id(`_state${serial++}`);
        destructures.set(node, temp);
        for (const element of node.name.elements) {
          if (ts.isIdentifier(element.name) && !element.dotDotDotToken) bind(element.name, f.createPropertyAccessExpression(['useMemo', 'useCallback'].includes(called) || ['useThemeStore', 'useNotificationStore'].includes(called) && init.arguments.length ? call(temp) : temp, element.propertyName?.text || element.name.text));
        }
      }
      if (ts.isIdentifier(node.name) && /^use[A-Z]/.test(called) && called !== 'useRef' && !signals.has(sym(node.name))) bind(node.name);
    }
    ts.forEachChild(node, scan);
  };
  scan(source);
  const isRead = node => {
    const parent = node.parent;
    if (!parent) return true;
    if ((ts.isPropertyAccessExpression(parent) && parent.name === node) || ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isGetAccessor(parent)) && parent.name === node)) return false;
    if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) || ts.isFunctionDeclaration(parent)) && parent.name === node) return false;
    if (ts.isImportSpecifier(parent) || ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent) || ts.isJsxAttribute(parent) || ts.isInterfaceDeclaration(parent) || ts.isPropertySignature(parent)) return false;
    if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
    return true;
  };
  const hasReactive = node => {
    if (!node) return false;
    if (ts.isIdentifier(node) && isRead(node) && reactive.has(sym(node))) return true;
    return !!ts.forEachChild(node, child => hasReactive(child) || undefined);
  };
  // Derived values must remain live; functions and hook instances retain identity.
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    const scanDerived = node => {
      const containingBlock = node.parent?.parent?.parent;
      const owner = containingBlock?.parent;
      const name = owner && functionName(owner);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && !reactive.has(sym(node.name)) && node.parent.flags & ts.NodeFlags.Const && ts.isBlock(containingBlock) && owner?.body === containingBlock && (/^[A-Z]/.test(name || '') || /^use[A-Z]/.test(name || ''))) {
        const init = node.initializer;
        const namedCall = ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text;
        if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init) && !ts.isObjectLiteralExpression(init) && !/^use[A-Z]/.test(namedCall || '') && hasReactive(init)) {
          memoVariables.add(node); bind(node.name, call(node.name.text), true); changed = true;
        }
      }
      ts.forEachChild(node, scanDerived);
    };
    scanDerived(source);
    if (!changed) break;
  }
  const transformed = ts.transform(source, [context => {
    const visit = node => {
      if (ts.isImportDeclaration(node)) {
        const module = node.moduleSpecifier.text;
        if (['preact/hooks', 'preact/compat'].includes(module)) return undefined;
        if (module === 'preact') {
          const names = node.importClause?.namedBindings?.elements?.filter(item => ['createContext', 'JSX'].includes(item.name.text));
          return names?.length ? f.updateImportDeclaration(node, node.modifiers, f.createImportClause(false, undefined, f.createNamedImports(names)), f.createStringLiteral('solid-js'), undefined) : undefined;
        }
        if (module === 'lucide-preact') return f.updateImportDeclaration(node, node.modifiers, node.importClause, f.createStringLiteral('lucide-solid'), undefined);
        if (module === 'wouter') return f.updateImportDeclaration(node, node.modifiers, node.importClause, f.createStringLiteral('@solidjs/router'), undefined);
        if (module === 'preact-iso') {
          const dest = path.relative(path.dirname(path.join(target, relative)), path.join(target, 'routing')).replaceAll('\\', '/');
          return f.updateImportDeclaration(node, node.modifiers, node.importClause, f.createStringLiteral(dest.startsWith('.') ? dest : './' + dest), undefined);
        }
      }
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        if (node.typeName.text === 'RefObject') return f.createTypeLiteralNode([f.createPropertySignature(undefined, 'current', undefined, f.createUnionTypeNode([node.typeArguments?.[0] || f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), f.createLiteralTypeNode(f.createNull())]))]);
        if (node.typeName.text === 'ComponentChildren') return f.createTypeReferenceNode('JSX.Element');
        if (node.typeName.text === 'FunctionComponent') return f.createTypeReferenceNode('Component', node.typeArguments);
      }
      if (ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName) && node.typeName.left.getText(source) === 'JSX') {
        if (node.typeName.right.text === 'TargetedMouseEvent') return f.createIntersectionTypeNode([f.createTypeReferenceNode('MouseEvent'), f.createTypeLiteralNode([f.createPropertySignature(undefined, 'currentTarget', undefined, node.typeArguments?.[0] || f.createTypeReferenceNode('HTMLElement'))])]);
        if (node.typeName.right.text === 'CSSProperties') return f.createTypeReferenceNode('Record', [f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword), f.createUnionTypeNode([f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword), f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)])]);
      }
      if (ts.isIdentifier(node) && isRead(node) && replacements.has(sym(node))) return ts.visitNode(replacements.get(sym(node)), visitGenerated);
      if (ts.isShorthandPropertyAssignment(node) && replacements.has(checker.getShorthandAssignmentValueSymbol(node))) {
        return f.createGetAccessorDeclaration(undefined, node.name, [], undefined, f.createBlock([f.createReturnStatement(ts.visitNode(replacements.get(checker.getShorthandAssignmentValueSymbol(node)), visitGenerated))], true));
      }
      if (ts.isObjectLiteralExpression(node)) {
        const receiver = ts.isCallExpression(node.parent) && ts.isIdentifier(node.parent.expression) ? node.parent.expression.text : '';
        const snapshot = /^set[A-Z]/.test(receiver);
        const result = f.updateObjectLiteralExpression(node, node.properties.map(property => {
          if (!snapshot && ts.isPropertyAssignment(property) && hasReactive(property.initializer) && !ts.isArrowFunction(property.initializer) && !ts.isFunctionExpression(property.initializer)) return f.createGetAccessorDeclaration(undefined, property.name, [], undefined, f.createBlock([f.createReturnStatement(ts.visitNode(property.initializer, visit))], true));
          return ts.visitNode(property, visit);
        }));
        if (!snapshot && node.properties.some(property => ts.isSpreadAssignment(property) && hasReactive(property.expression))) return call('mergeProps', result.properties.map(property => ts.isSpreadAssignment(property) ? arrow(property.expression) : f.createObjectLiteralExpression([property])));
        return result;
      }
      if (ts.isVariableDeclaration(node)) {
        let name = node.name;
        if (destructures.has(node)) name = destructures.get(node);
        let init = ts.visitNode(node.initializer, visit);
        if (memoVariables.has(node)) init = call('createMemo', [arrow(init)]);
        let type = ts.visitNode(node.type, visit);
        if (memoVariables.has(node) && type) type = f.createTypeReferenceNode('Accessor', [type]);
        return f.updateVariableDeclaration(node, name, node.exclamationToken, type, init);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const args = node.arguments.map(arg => ts.visitNode(arg, visit));
        if (name === 'useState') {
          let initial = args[0];
          if (node.arguments[0] && checker.getTypeAtLocation(node.arguments[0]).getCallSignatures().length) initial = call(initial);
          return call('createSignal', initial ? [initial] : [], node.typeArguments);
        }
        if (name === 'useRef') return f.createAsExpression(f.createObjectLiteralExpression([f.createPropertyAssignment('current', args[0] || id('undefined'))]), f.createTypeLiteralNode([f.createPropertySignature(undefined, 'current', undefined, node.typeArguments?.[0] ? f.createUnionTypeNode([node.typeArguments[0], f.createLiteralTypeNode(f.createNull())]) : f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword))]));
        if (name === 'useMemo') return call('createMemo', [args[0]]);
        if (name === 'useCallback') return call('createMemo', [call('on', [arrow(args[1] || f.createArrayLiteralExpression()), arrow(args[0])])]);
        if (name === 'useEffect' || name === 'useLayoutEffect') {
          const cleanup = id(`_cleanup${serial++}`);
          const body = f.createBlock([
            f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration(cleanup, undefined, undefined, call('untrack', [args[0]]))], ts.NodeFlags.Const)),
            f.createIfStatement(f.createBinaryExpression(f.createTypeOfExpression(cleanup), ts.SyntaxKind.EqualsEqualsEqualsToken, f.createStringLiteral('function')), f.createExpressionStatement(call('onCleanup', [cleanup]))),
          ], true);
          return call('createEffect', [call('on', [arrow(args[1] || f.createArrayLiteralExpression()), arrow(body)])]);
        }
        if (name === 'useContext') return call('useContext', args, node.typeArguments);
        if (name === 'memo') return args[0];
        if (name === 'useNotificationStore') return args.length ? call('createMemo', [arrow(call('useNotificationStore', args))]) : call('useNotificationStore');
        if (name === 'useThemeStore') return args.length ? call('createMemo', [arrow(call('useThemeStore', args))]) : call('useThemeStore');
        if (name === 'createPortal') return f.createJsxElement(f.createJsxOpeningElement(id('Portal'), undefined, f.createJsxAttributes([f.createJsxAttribute(id('mount'), f.createJsxExpression(undefined, args[1]))])), [f.createJsxExpression(undefined, args[0])], f.createJsxClosingElement(id('Portal')));
        if (hookNames.has(name) && hookParams.has(name)) return f.updateCallExpression(node, node.expression, node.typeArguments, args.map((arg, index) => hookParams.get(name)[index] === 'accessor' ? arrow(arg) : arg));
      }
      if (ts.isJsxAttribute(node)) {
        if (node.name.text === 'key') return undefined;
        if (node.name.text === 'jsx' && node.parent.parent.tagName?.getText(source) === 'style') return undefined;
        const tag = node.parent.parent.tagName?.getText(source) || '';
        if (node.name.text === 'onChange' && ['input', 'textarea'].includes(tag)) {
          const type = node.parent.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'type')?.initializer;
          if (!type || !ts.isStringLiteral(type) || !['checkbox', 'radio', 'file'].includes(type.text)) return f.updateJsxAttribute(node, id('onInput'), ts.visitNode(node.initializer, visit));
        }
        if (node.name.text === 'className' && (/^[a-z]/.test(tag) || icons.has(tag))) return f.updateJsxAttribute(node, id('class'), ts.visitNode(node.initializer, visit));
        const attributeNames = { htmlFor: 'for', autoComplete: 'autocomplete', autoFocus: 'autofocus', autoPlay: 'autoplay', playsInline: 'playsinline', allowFullScreen: 'allowfullscreen', onDoubleClick: 'onDblClick' };
        if (/^[a-z]/.test(tag) && attributeNames[node.name.text]) return f.updateJsxAttribute(node, id(attributeNames[node.name.text]), ts.visitNode(node.initializer, visit));
        if (node.name.text === 'dangerouslySetInnerHTML' && ts.isJsxExpression(node.initializer)) return f.createJsxAttribute(id('innerHTML'), f.createJsxExpression(undefined, f.createPropertyAccessExpression(ts.visitNode(node.initializer.expression, visit), '__html')));
        if (node.name.text === 'ref' && ts.isJsxExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && refs.has(sym(node.initializer.expression))) return f.createJsxAttribute(id('ref'), f.createJsxExpression(undefined, f.createArrowFunction(undefined, undefined, [f.createParameterDeclaration(undefined, undefined, '_element')], undefined, undefined, f.createBinaryExpression(f.createPropertyAccessExpression(node.initializer.expression, 'current'), ts.SyntaxKind.EqualsToken, id('_element')))));
        if (node.name.text === 'style' && /^[a-z]/.test(tag) && ts.isJsxExpression(node.initializer)) return f.updateJsxAttribute(node, node.name, f.createJsxExpression(undefined, call('cssStyle', [ts.visitNode(node.initializer.expression, visit)])));
      }
      if (ts.isFunctionLike(node) && node.body) {
        const plans = parameterPlans.get(node) || [];
        const parameters = node.parameters.map(parameter => {
          const plan = plans.find(plan => plan.parameter === parameter);
          if (!plan) return f.updateParameterDeclaration(parameter, parameter.modifiers, parameter.dotDotDotToken, parameter.name, parameter.questionToken, ts.visitNode(parameter.type, visit), ts.visitNode(parameter.initializer, visit));
          return f.updateParameterDeclaration(parameter, parameter.modifiers, parameter.dotDotDotToken, plan.replacement || parameter.name, plan.accessor ? undefined : parameter.questionToken, plan.accessor ? f.createTypeReferenceNode('Accessor', [ts.visitNode(parameter.type, visit) || f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)]) : ts.visitNode(parameter.type, visit), plan.accessor ? parameter.initializer ? arrow(parameter.initializer) : parameter.questionToken ? arrow(id('undefined')) : undefined : parameter.initializer);
        });
        let body = ts.visitNode(node.body, visit);
        if (ts.isBlock(body)) {
          const restStatements = plans.flatMap(plan => ts.isObjectBindingPattern(plan.parameter.name) ? plan.parameter.name.elements.filter(element => element.dotDotDotToken).map(element => f.createVariableStatement(undefined, f.createVariableDeclarationList([f.createVariableDeclaration(element.name, undefined, undefined, f.createElementAccessExpression(call('splitProps', [plan.replacement, f.createArrayLiteralExpression(plan.parameter.name.elements.filter(element => !element.dotDotDotToken).map(element => f.createStringLiteral(element.propertyName?.text || element.name.text)))]), f.createNumericLiteral(1)))], ts.NodeFlags.Const))) : []);
          body = f.updateBlock(body, [...restStatements, ...body.statements]);
        }
        const name = functionName(node);
        if (/^[A-Z]/.test(name) && ts.isBlock(body)) {
          const hasReturn = statement => !!ts.forEachChild(statement, child => ts.isReturnStatement(child) || (!ts.isFunctionLike(child) && hasReturn(child)) || undefined);
          const first = body.statements.findIndex(statement => ts.isReturnStatement(statement) || (ts.isIfStatement(statement) && hasReturn(statement)));
          if (first >= 0 && body.statements.slice(first).some(ts.isIfStatement)) body = f.updateBlock(body, [...body.statements.slice(0, first), f.createReturnStatement(f.createAsExpression(f.createAsExpression(call('createMemo', [arrow(f.createBlock(body.statements.slice(first), true))]), f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)), f.createTypeReferenceNode('JSX.Element')))]);
        }
        if (scalarHooks.has(name) && ts.isBlock(body)) body = f.updateBlock(body, body.statements.map(statement => ts.isReturnStatement(statement) ? f.updateReturnStatement(statement, arrow(statement.expression)) : statement));
        if (ts.isArrowFunction(node)) return f.updateArrowFunction(node, node.modifiers, node.typeParameters, parameters, node.type, node.equalsGreaterThanToken, body);
        if (ts.isFunctionDeclaration(node)) return f.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, parameters, node.type, body);
        if (ts.isFunctionExpression(node)) return f.updateFunctionExpression(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, parameters, node.type, body);
      }
      if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.expression.left) && node.expression.left.name.text === 'current' && ts.isBlock(node.parent) && node.parent.parent?.body === node.parent && (/^[A-Z]/.test(functionName(node.parent.parent)) || /^use[A-Z]/.test(functionName(node.parent.parent))) && hasReactive(node.expression.right)) return f.createExpressionStatement(call('createEffect', [arrow(ts.visitNode(node.expression, visit))]));
      return ts.visitEachChild(node, visit, context);
    };
    const visitGenerated = node => ts.visitEachChild(node, visitGenerated, context);
    return node => {
      const result = ts.visitNode(node, visit);
      const additions = { statements: [
        f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports(['createSignal', 'createMemo', 'createEffect', 'on', 'onCleanup', 'untrack', 'useContext', 'splitProps', 'mergeProps', 'Accessor', 'Component', 'JSX'].map(name => f.createImportSpecifier(['Accessor', 'Component', 'JSX'].includes(name), undefined, id(name))))), f.createStringLiteral('solid-js')),
        f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports([f.createImportSpecifier(false, undefined, id('Portal'))])), f.createStringLiteral('solid-js/web')),
      ] };
      let styleImport = path.relative(path.dirname(path.join(target, relative)), path.join(target, 'utils/cssStyle')).replaceAll('\\', '/');
      if (!styleImport.startsWith('.')) styleImport = './' + styleImport;
      additions.statements.push(f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports(['cssStyle', 'Fragment'].map(name => f.createImportSpecifier(false, undefined, id(name))))), f.createStringLiteral(styleImport)));
      const existingJSX = result.statements.some(statement => ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'solid-js');
      const head = additions.statements.map(statement => existingJSX && ts.isImportDeclaration(statement) ? f.updateImportDeclaration(statement, undefined, f.updateImportClause(statement.importClause, false, undefined, f.createNamedImports(statement.importClause.namedBindings.elements.filter(specifier => !['JSX'].includes(specifier.name.text)))), statement.moduleSpecifier, undefined) : statement);
      return f.updateSourceFile(result, [...head, ...result.statements]);
    };
  }]);
  const output = path.join(target, relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]));
  transformed.dispose(); converted++;
}
const publicTarget = path.resolve(import.meta.dirname, '../public');
fs.cpSync(path.resolve(root, '../public'), publicTarget, { recursive: true, filter: file => !['wrangler', '_headers', '_redirects'].includes(path.basename(file)) });
console.log(`Ported ${converted} source modules and copied shared design assets. Original app unchanged.`);
