import ts from "typescript";

const appFeatureCompositionFiles = new Set([
  "app/adapters/app.adapters.ts",
  "app/adapters/app-offline.adapter.ts",
  "app/adapters/app-offline.composition.ts",
  "app/adapters/mock/app.mock-adapters.ts",
  "app/adapters/public.ts",
  "app/app.localization.ts",
]);

const generatedRegistryConsumers = new Set(["app/app.localization.ts", "app/app.pages.ts"]);

export function mayAppImportFeature(relativeFile) {
  return appFeatureCompositionFiles.has(relativeFile.replaceAll("\\", "/"));
}

export function mayImportGeneratedRegistry(relativeFile) {
  const normalized = relativeFile.replaceAll("\\", "/");
  return normalized.startsWith("generated/") || generatedRegistryConsumers.has(normalized);
}

export function signalModuleProblems(fileName, source) {
  const problems = [];
  if (!/^sig[A-Z][A-Za-z0-9]*\.ts$/u.test(fileName)) {
    problems.push("must use the sig<Name>.ts naming convention");
  }

  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const signalFactories = new Set();
  const signalNamespaces = new Set();
  let exportedSignalCount = 0;

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@preact/signals-react"
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (importedName === "signal" || importedName === "computed") signalFactories.add(element.name.text);
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      signalNamespaces.add(bindings.name.text);
    }
  }

  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) {
      problems.push("may export const signals only");
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const validName = ts.isIdentifier(declaration.name) && /^sig[A-Z][A-Za-z0-9]*$/u.test(declaration.name.text);
      const initializer = declaration.initializer;
      const validInitializer =
        initializer &&
        ts.isCallExpression(initializer) &&
        ((ts.isIdentifier(initializer.expression) && signalFactories.has(initializer.expression.text)) ||
          (ts.isPropertyAccessExpression(initializer.expression) &&
            ts.isIdentifier(initializer.expression.expression) &&
            signalNamespaces.has(initializer.expression.expression.text) &&
            (initializer.expression.name.text === "signal" || initializer.expression.name.text === "computed")));

      if (!validName || !validInitializer) {
        problems.push("may export only sig<Name> values created by signal() or computed()");
      } else {
        exportedSignalCount += 1;
      }
    }
  }

  if (exportedSignalCount === 0) problems.push("must export at least one signal");
  return [...new Set(problems)];
}

export function usesGlobalSignalEffect(source) {
  const sourceFile = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const effectBindings = new Set();
  const signalNamespaces = new Set();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      (statement.moduleSpecifier.text !== "@preact/signals-react" &&
        statement.moduleSpecifier.text !== "@preact/signals-core")
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName?.text ?? element.name.text) === "effect") effectBindings.add(element.name.text);
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      signalNamespaces.add(bindings.name.text);
    }
  }

  let used = false;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const directEffect = ts.isIdentifier(node.expression) && effectBindings.has(node.expression.text);
      const namespaceEffect =
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        signalNamespaces.has(node.expression.expression.text) &&
        node.expression.name.text === "effect";
      if (directEffect || namespaceEffect) {
        used = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return used;
}

export function mayDefineGlobalSignalEffects(relativeFile) {
  return relativeFile.replaceAll("\\", "/") === "app/init-signal-effects.ts";
}
