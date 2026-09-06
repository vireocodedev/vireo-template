import assert from "node:assert/strict";
import test from "node:test";

import {
  mayAppImportFeature,
  mayDefineGlobalSignalEffects,
  mayImportGeneratedRegistry,
  signalModuleProblems,
  usesGlobalSignalEffect,
} from "./architecture-policy.mjs";

test("only explicit application composition adapters may depend on business features", () => {
  assert.equal(mayAppImportFeature("app/adapters/app.adapters.ts"), true);
  assert.equal(mayAppImportFeature("app/adapters/app-offline.adapter.ts"), true);
  assert.equal(mayAppImportFeature("app/adapters/mock/app.mock-adapters.ts"), true);
  assert.equal(mayAppImportFeature("app/app.localization.ts"), true);
  assert.equal(mayAppImportFeature("app/shell/providers/AppProvider.tsx"), false);
  assert.equal(mayAppImportFeature("app/data/query/query-client.ts"), false);
});

test("generated capability imports stay within the registry composition boundary", () => {
  assert.equal(mayImportGeneratedRegistry("generated/orders/order.capability.ts"), true);
  assert.equal(mayImportGeneratedRegistry("app/app.pages.ts"), true);
  assert.equal(mayImportGeneratedRegistry("app/app.localization.ts"), true);
  assert.equal(mayImportGeneratedRegistry("pages/home/AppPageHome.tsx"), false);
  assert.equal(mayImportGeneratedRegistry("features/item/public.ts"), false);
});

test("signal modules export only conventionally named signals", () => {
  assert.deepEqual(
    signalModuleProblems(
      "sigCount.ts",
      'import { computed, signal } from "@preact/signals-react";\nexport const sigCount = signal(0);\nexport const sigDouble = computed(() => sigCount.value * 2);\n',
    ),
    [],
  );
  assert.match(signalModuleProblems("count.ts", "export const sigCount = signal(0);").join("\n"), /sig<Name>/u);
  assert.match(signalModuleProblems("sigCount.ts", "export const sigCount = 1;").join("\n"), /signal\(\)/u);
  assert.match(
    signalModuleProblems("sigCount.ts", "const signal = value => value;\nexport const sigCount = signal(0);").join(
      "\n",
    ),
    /signal\(\)/u,
  );
  assert.match(
    signalModuleProblems(
      "sigCount.ts",
      'import { signal } from "wrong-package";\nexport const sigCount = signal(0);',
    ).join("\n"),
    /signal\(\)/u,
  );
  assert.match(
    signalModuleProblems("sigCount.ts", "export const sigCount = signal(0), helper = 1;").join("\n"),
    /signal\(\)/u,
  );
  assert.match(
    signalModuleProblems("sigCount.ts", "export const sigCount = signal(0);\nexport function reset() {}").join("\n"),
    /const signals/u,
  );
});

test("global signal effects have one application bootstrap boundary", () => {
  assert.equal(
    usesGlobalSignalEffect('import { effect as signalEffect } from "@preact/signals-react";\nsignalEffect(() => {});'),
    true,
  );
  assert.equal(
    usesGlobalSignalEffect('import * as signals from "@preact/signals-react";\nsignals.effect(() => {});'),
    true,
  );
  assert.equal(usesGlobalSignalEffect('import { effect } from "@preact/signals-core";\neffect(() => {});'), true);
  assert.equal(usesGlobalSignalEffect("React.useEffect(() => {});"), false);
  assert.equal(mayDefineGlobalSignalEffects("app/init-signal-effects.ts"), true);
  assert.equal(mayDefineGlobalSignalEffects("features/item/signals/sigItems.ts"), false);
});
