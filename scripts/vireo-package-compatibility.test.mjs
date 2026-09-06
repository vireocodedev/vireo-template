import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateVireoPackageCompatibility,
  evaluateVireoPackageLockCompatibility,
} from "./vireo-package-compatibility.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const contract = readJson("contracts/vireo-package-compatibility.json");
const frontend = readJson("frontend/package.json");
const lock = readJson("frontend/package-lock.json");

const clonedLock = () => structuredClone(lock);

test("the current public Vireo declarations and lock are exact and compatible", () => {
  assert.deepEqual(
    evaluateVireoPackageCompatibility(frontend.dependencies, contract),
    { compatible: true, problems: [] },
  );
  assert.deepEqual(
    evaluateVireoPackageLockCompatibility({
      dependencies: frontend.dependencies,
      lock,
      contract,
    }),
    { compatible: true, problems: [] },
  );
});

test("rejects an older semver-compatible Vireo UI lock resolution", () => {
  const stale = clonedLock();
  const ui = stale.packages["node_modules/@vireocodedev/ui"];
  ui.version = "0.3.0";
  ui.resolved = "https://registry.npmjs.org/@vireocodedev/ui/-/ui-0.3.0.tgz";

  const result = evaluateVireoPackageLockCompatibility({
    dependencies: frontend.dependencies,
    lock: stale,
    contract,
  });
  assert.equal(result.compatible, false);
  assert.match(
    result.problems.join("\n"),
    /resolves 0\.3\.0; expected 0\.3\.2/u,
  );
});

test("rejects manifest, lock-root, and unexpected-coordinate drift", () => {
  const staleManifest = {
    ...frontend.dependencies,
    "@vireocodedev/ui": "^0.3.0",
  };
  assert.equal(
    evaluateVireoPackageCompatibility(staleManifest, contract).compatible,
    false,
  );

  const drifted = clonedLock();
  drifted.packages[""].dependencies["@vireocodedev/ui"] = "^0.3.0";
  drifted.packages["node_modules/example/node_modules/@vireocodedev/unknown"] =
    {
      version: "0.1.0",
      resolved:
        "https://registry.npmjs.org/@vireocodedev/unknown/-/unknown-0.1.0.tgz",
      integrity: "sha512-example",
    };

  const result = evaluateVireoPackageLockCompatibility({
    dependencies: frontend.dependencies,
    lock: drifted,
    contract,
  });
  assert.equal(result.compatible, false);
  assert.match(result.problems.join("\n"), /root lock declaration/u);
  assert.match(
    result.problems.join("\n"),
    /not an expected locked Vireo coordinate/u,
  );
});

test("rejects a nested-only substitute for a declared direct Vireo package", () => {
  const nestedOnly = clonedLock();
  const ui = nestedOnly.packages["node_modules/@vireocodedev/ui"];
  delete nestedOnly.packages["node_modules/@vireocodedev/ui"];
  nestedOnly.packages["node_modules/example/node_modules/@vireocodedev/ui"] =
    ui;

  const result = evaluateVireoPackageLockCompatibility({
    dependencies: frontend.dependencies,
    lock: nestedOnly,
    contract,
  });
  assert.equal(result.compatible, false);
  assert.match(
    result.problems.join("\n"),
    /canonical top-level package-lock entry/u,
  );
});

test("rejects linked, alternate-registry, and malformed-integrity lock entries", () => {
  const drifted = clonedLock();
  const ui = drifted.packages["node_modules/@vireocodedev/ui"];
  ui.link = true;
  ui.resolved =
    "https://registry.example.invalid/@vireocodedev/ui/-/ui-0.3.1.tgz";
  ui.integrity = "sha256-not-allowed";

  const result = evaluateVireoPackageLockCompatibility({
    dependencies: frontend.dependencies,
    lock: drifted,
    contract,
  });
  assert.equal(result.compatible, false);
  assert.match(
    result.problems.join("\n"),
    /must not be a linked local package/u,
  );
  assert.match(result.problems.join("\n"), /exact public npm tarball/u);
  assert.match(result.problems.join("\n"), /sha512 npm integrity/u);
});

test("requires every declared direct Vireo dependency to have an exact lock coordinate", () => {
  const withoutUiCoordinate = structuredClone(contract);
  delete withoutUiCoordinate.lockedPackages["@vireocodedev/ui"];

  const result = evaluateVireoPackageLockCompatibility({
    dependencies: frontend.dependencies,
    lock,
    contract: withoutUiCoordinate,
  });
  assert.equal(result.compatible, false);
  assert.match(
    result.problems.join("\n"),
    /must declare an exact locked Vireo coordinate/u,
  );
});
