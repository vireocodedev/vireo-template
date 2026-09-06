import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { writeTemplateReleaseManifest } from "./write-template-release-manifest.mjs";

const policy = {
  schemaVersion: 1,
  version: "0.9.0",
  tag: "starter-template@0.9.0",
  createVireoVersion: "0.9.0",
  ecosystemRelease: "npm-0.9.0_jvm-0.4.0",
  repository: "vireocodedev/vireo-template",
  releaseUrl: "https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%400.9.0",
  immutableReleasesRequired: true,
};

test("writes a schema-1 manifest to disk from an unprepared artifact binding", () => {
  // This exercises the exact `join(root, "contracts/template-release-artifacts.json")`
  // read path that regressed with a `ReferenceError: join is not defined` the
  // first time this script ran for real in production (join was used but not
  // imported from node:path).
  const root = mkdtempSync(join(tmpdir(), "vireo-release-manifest-"));
  try {
    mkdirSync(join(root, "contracts"), { recursive: true });
    writeFileSync(join(root, "contracts/template-release-artifacts.json"), JSON.stringify({ schemaVersion: 1, prepared: false, mavenGroup: "com.vireocode" }));
    const output = join(root, "..", "release-manifest-output.json");
    const manifest = writeTemplateReleaseManifest({ output, policy, commit: "a".repeat(40), root });
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.version, "0.9.0");
    assert.equal(manifest.commit, "a".repeat(40));
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), manifest);
    rmSync(output, { force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
