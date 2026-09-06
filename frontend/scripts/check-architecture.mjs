import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  mayAppImportFeature,
  mayDefineGlobalSignalEffects,
  mayImportGeneratedRegistry,
  signalModuleProblems,
  usesGlobalSignalEffect,
} from "./architecture-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const errors = [];

const allowedSourceEntries = new Set([
  "@types",
  "app",
  "features",
  "generated",
  "pages",
  "main.css",
  "main.tsx",
  "vite-env.d.ts",
]);
const allowedFeatureDirectories = new Set([
  "api",
  "assets",
  "components",
  "config",
  "contexts",
  "hooks",
  "localization",
  "models",
  "offline",
  "providers",
  "services",
  "signals",
  "state",
  "storybook",
  "tests",
]);
const forbiddenDirectoryNames = new Set(["common", "helpers", "shared", "utils"]);
const loadingCategories = new Set(["boundary", "busy-action", "content-preserving", "skeleton-capable"]);
const canonicalAsyncStoryPattern = /export\s+const\s+(?:Loading|Refreshing|Empty|Error|AlignmentContract)\b/u;
const unsafeNumericBorderShorthandPattern =
  /\bborder(?:Top|Right|Bottom|Left|Block(?:Start|End)?|Inline(?:Start|End)?)?\s*:\s*(?:\d+(?:\.\d+)?|\{[^}]*?\b(?:xs|sm|md|lg|xl)\s*:\s*\d+(?:\.\d+)?)/gu;

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

for (const entry of await readdir(sourceRoot)) {
  if (!allowedSourceEntries.has(entry)) errors.push(`Unexpected src entry: ${entry}`);
}

const featureRoot = path.join(sourceRoot, "features");
for (const featureName of await readdir(featureRoot)) {
  const featurePath = path.join(featureRoot, featureName);
  if (!(await stat(featurePath)).isDirectory()) {
    errors.push(`Features may contain only capability directories: ${featureName}`);
    continue;
  }

  const featureEntries = await readdir(featurePath, { withFileTypes: true });
  if (!featureEntries.some(entry => entry.isFile() && entry.name === "public.ts")) {
    errors.push(`Feature ${featureName} is missing its root public.ts`);
  }

  for (const entry of featureEntries) {
    if (entry.isFile() && entry.name !== "public.ts") {
      errors.push(`Feature ${featureName} has a root file other than public.ts: ${entry.name}`);
    }
    if (entry.isDirectory() && !allowedFeatureDirectories.has(entry.name)) {
      errors.push(`Feature ${featureName} has a non-standard directory: ${entry.name}`);
    }
  }
}

const sourceFiles = (await filesBelow(sourceRoot)).filter(file => /\.[cm]?[jt]sx?$/.test(file));
const sourceDirectories = (await filesBelow(sourceRoot)).map(file => path.dirname(file));
const featureImportPattern = /(?:from\s+|import\s*\()\s*["']@\/features\/([^/"']+)([^"']*)["']/g;
const pageImportPattern = /(?:from\s+|import\s*\()\s*["']@\/pages\/([^"']+)["']/g;
const formFieldsExportPattern = /export\s+function\s+([A-Z][A-Za-z0-9]*FormFields)\s*\(/u;
const legacyEntityFormExportPattern = /export\s+function\s+[A-Z][A-Za-z0-9]*Form\s*\(/u;

for (const directory of new Set(sourceDirectories)) {
  const segments = path.relative(sourceRoot, directory).split(path.sep);
  const forbiddenSegment = segments.find(segment => forbiddenDirectoryNames.has(segment));
  if (forbiddenSegment) {
    errors.push(`${path.relative(sourceRoot, directory)} uses forbidden dumping-ground directory ${forbiddenSegment}`);
  }
}

for (const pageName of await readdir(path.join(sourceRoot, "pages"))) {
  const pagePath = path.join(sourceRoot, "pages", pageName);
  if (!(await stat(pagePath)).isDirectory()) {
    errors.push(`Pages may contain only route directories: ${pageName}`);
    continue;
  }

  const hasRouteComponent = (await readdir(pagePath)).some(name => /^AppPage.+\.tsx$/.test(name));
  if (!hasRouteComponent) errors.push(`Page ${pageName} is missing a direct AppPage*.tsx route component`);
}

for (const file of sourceFiles) {
  const relativeFile = path.relative(sourceRoot, file);
  const normalizedRelativeFile = relativeFile.replaceAll(path.sep, "/");
  const fileName = path.basename(file);
  const inSignalsDirectory = path.basename(path.dirname(file)) === "signals";
  const ownFeature = relativeFile.startsWith(`features${path.sep}`) ? relativeFile.split(path.sep)[1] : undefined;
  const source = await readFile(file, "utf8");

  if (inSignalsDirectory) {
    errors.push(
      ...signalModuleProblems(fileName, source).map(problem => `${relativeFile} is a signal definition and ${problem}`),
    );
  }

  if (usesGlobalSignalEffect(source) && !mayDefineGlobalSignalEffects(normalizedRelativeFile)) {
    errors.push(
      `${relativeFile} defines a global signal effect outside app/init-signal-effects.ts; use useSignalEffect for component-local effects`,
    );
  }

  const formFieldsExport = source.match(formFieldsExportPattern);
  if (formFieldsExport) {
    const componentName = formFieldsExport[1];
    const expectedRelativeFile = `features/${ownFeature}/components/forms/${componentName}/${componentName}.tsx`;
    if (normalizedRelativeFile !== expectedRelativeFile) {
      errors.push(`${relativeFile} must place ${componentName} at ${expectedRelativeFile}`);
    }

    const propsPattern = new RegExp(`export\\s+type\\s+${componentName}Props\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`, "u");
    const propsBody = source.match(propsPattern)?.[1];
    if (!propsBody) {
      errors.push(`${relativeFile} must export ${componentName}Props as an object type`);
    } else {
      const propNames = [...propsBody.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)(\?)?\s*:/gmu)];
      const declaredNames = propNames.map(match => match[1]).sort();
      if (declaredNames.join(",") !== "form,mode" || propNames.some(match => match[2] === "?")) {
        errors.push(`${relativeFile} form-fields props must contain exactly required form and mode properties`);
      }
      if (!/\bform:\s*[A-Z][A-Za-z0-9]*FormApi\s*;/u.test(propsBody)) {
        errors.push(`${relativeFile} form must use the feature's named *FormApi type`);
      }
      if (!/\bmode:\s*AppFormMode\s*;/u.test(propsBody)) {
        errors.push(`${relativeFile} mode must use the shared AppFormMode type`);
      }
    }

    if (!source.includes("VireoContainerGrid")) {
      errors.push(`${relativeFile} must own its layout through VireoContainerGrid`);
    }
    if (source.includes('component="section"') || source.includes("aria-labelledby")) {
      errors.push(`${relativeFile} must render fields only; semantic sections and headings belong to the host`);
    }
    if (/<form\.(?:Form|Actions|SubmitButton)\b/u.test(source)) {
      errors.push(`${relativeFile} may render fields only; form boundaries and actions belong to the host`);
    }
  }

  if (
    normalizedRelativeFile.includes("/components/forms/") &&
    normalizedRelativeFile.endsWith(".tsx") &&
    legacyEntityFormExportPattern.test(source)
  ) {
    errors.push(`${relativeFile} exports an ambiguous *Form component; entity field components use *FormFields`);
  }

  for (const match of source.matchAll(unsafeNumericBorderShorthandPattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    errors.push(
      `${relativeFile}:${line} uses a numeric border shorthand; use border width/style longhands with an explicit semantic border color, or a color-complete CSS shorthand`,
    );
  }

  if (/from\s+["']@mui\/material["'][\s\S]*\bSkeleton\b/u.test(source)) {
    errors.push(`${relativeFile} imports raw MUI Skeleton; use the Vireo skeleton leaves and loading boundary`);
  }

  if (
    relativeFile.startsWith(`pages${path.sep}`) &&
    /(?:function|const)\s+[A-Za-z0-9]*(?:Page|Route)?Skeleton\b/u.test(source)
  ) {
    errors.push(
      `${relativeFile} declares a standalone page skeleton tree; render loading leaves through the real page composition`,
    );
  }

  if (relativeFile.endsWith(".stories.tsx") && canonicalAsyncStoryPattern.test(source)) {
    const categoryMatch = source.match(/categories:\s*\[([^\]]+)\]/u);
    const geometryMatch = source.match(/geometry:\s*["']([ABC])["']/u);
    const declaredCategories = categoryMatch?.[1].match(/["']([^"']+)["']/gu)?.map(value => value.slice(1, -1));

    if (!declaredCategories?.length || declaredCategories.some(category => !loadingCategories.has(category))) {
      errors.push(`${relativeFile} must declare supported parameters.vireo.loading.categories`);
    }
    if (!geometryMatch) {
      errors.push(`${relativeFile} must declare parameters.vireo.loading.geometry as A, B, or C`);
    }
  }

  if (/\/index\.[cm]?[jt]sx?$/.test(file.replaceAll(path.sep, "/"))) {
    errors.push(`${relativeFile} is an index barrel; use an explicit file or feature public.ts`);
  }

  for (const match of source.matchAll(featureImportPattern)) {
    const importedFeature = match[1];
    const importedSuffix = match[2];
    if (ownFeature === importedFeature) {
      errors.push(`${relativeFile} imports its own feature through @; use a relative import`);
      continue;
    }

    const isPublicImport = importedSuffix === "/public" || importedSuffix.endsWith("/public");
    const isLocalizationRegistryImport =
      relativeFile === "app/app.localization.ts" && importedSuffix.startsWith("/localization/resources/");

    if (relativeFile.startsWith(`app${path.sep}`) && !mayAppImportFeature(relativeFile)) {
      errors.push(
        `${relativeFile} makes an undeclared app-to-feature dependency; compose feature APIs only in app adapters or app.localization.ts`,
      );
      continue;
    }

    if (!isPublicImport && !isLocalizationRegistryImport) {
      errors.push(
        `${relativeFile} reaches into feature ${importedFeature}; import @/features/${importedFeature}/public`,
      );
    }
  }

  for (const _match of source.matchAll(/(?:from\s+|import\s*\()\s*["']@\/generated\/([^"']+)["']/g)) {
    if (!mayImportGeneratedRegistry(relativeFile)) {
      errors.push(`${relativeFile} imports the managed generated registry outside app.pages.ts or app.localization.ts`);
    }
  }

  for (const _match of source.matchAll(pageImportPattern)) {
    const isRouteRegistry = relativeFile === "app/app.pages.ts";
    const isLocalizationRegistryImport =
      relativeFile === "app/app.localization.ts" && _match[1].includes("/localization/resources/");
    if (!isRouteRegistry && !isLocalizationRegistryImport) {
      errors.push(
        `${relativeFile} imports a page outside an allowed composition boundary; routes belong in app/app.pages.ts and translation resources in app/app.localization.ts`,
      );
    }
  }
}

const globalSignalEffectsFile = path.join(sourceRoot, "app", "init-signal-effects.ts");
const mainFile = path.join(sourceRoot, "main.tsx");
const globalSignalEffectsSource = await readFile(globalSignalEffectsFile, "utf8").catch(() => undefined);
const mainSource = await readFile(mainFile, "utf8");

if (!globalSignalEffectsSource?.includes("export function initSignalEffects")) {
  errors.push("app/init-signal-effects.ts must define the centralized global signal-effect initializer");
}
const signalEffectsCallIndex = mainSource.indexOf("initSignalEffects();");
const reactMountIndex = mainSource.indexOf("ReactDOM.createRoot");
if (signalEffectsCallIndex < 0 || reactMountIndex < 0 || signalEffectsCallIndex > reactMountIndex) {
  errors.push("main.tsx must initialize global signal effects before rendering");
}

if (errors.length > 0) {
  console.error("Architecture contract violations:\n");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Architecture contract passed.");
