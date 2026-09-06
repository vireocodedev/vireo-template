import assert from "node:assert/strict";
import test from "node:test";

import {
  assertGeneratedReleasePaths,
  completeWorkingTreePaths,
  createPreparationMarker,
  createPreparationPullRequest,
  parseTemplatePreparationWorkflowInput,
  validateExistingPreparationPullRequests,
} from "./template-release-preparation-workflow.mjs";
import { releasePreparationGeneratedPaths } from "./template-release-prepare.mjs";

const npmVersions = {
  "@vireocodedev/history": "0.2.3",
  "@vireocodedev/infrastructure": "0.2.3",
  "@vireocodedev/localization": "0.2.3",
  "@vireocodedev/query": "0.2.3",
  "@vireocodedev/shell": "0.2.3",
  "@vireocodedev/sqlite": "0.2.4",
  "@vireocodedev/ui": "0.3.2",
};

function inputFor(overrides = {}) {
  return parseTemplatePreparationWorkflowInput({
    release_version: "0.8.8",
    jvm_version: "0.3.2",
    npm_versions: JSON.stringify(npmVersions),
    ...overrides,
  });
}

test("accepts only strict canonical hosted release input", () => {
  const input = inputFor();
  assert.equal(input.templateVersion, "0.8.8");
  assert.equal(input.createVireoVersion, "0.8.8");
  assert.equal(input.npm.length, 7);
  assert.deepEqual(Object.keys(input.npmVersions), Object.keys(npmVersions));
  assert.match(input.inputSha256, /^[0-9a-f]{64}$/u);
  assert.throws(() => inputFor({ npm_versions: JSON.stringify({ ...npmVersions, "@vireocodedev/unexpected": "0.2.3" }) }), /invalid Vireo npm coordinate/u);
  assert.throws(() => inputFor({ npm_versions: "[]" }), /JSON object/u);
  assert.throws(() => inputFor({ release_version: "1.0.0" }), /strict 0.x semver/u);
});

test("accepts the fixed release-owned write set, or any non-empty subset of it", () => {
  assert.deepEqual(assertGeneratedReleasePaths([...releasePreparationGeneratedPaths].reverse()), [...releasePreparationGeneratedPaths].sort());
  assert.deepEqual(
    assertGeneratedReleasePaths(releasePreparationGeneratedPaths.slice(1)),
    [...releasePreparationGeneratedPaths.slice(1)].sort(),
  );
  assert.throws(() => assertGeneratedReleasePaths([]), /managed release paths/u);
  assert.throws(() => assertGeneratedReleasePaths([...releasePreparationGeneratedPaths, "unrelated-file"]), /managed release paths/u);
  assert.throws(() => assertGeneratedReleasePaths(["unrelated-file"]), /managed release paths/u);
});

test("fails closed for untracked output and exposes both sides of a rename before staging", () => {
  const calls = [];
  const paths = completeWorkingTreePaths({
    baseCommit: "a".repeat(40),
    runner: (arguments_) => {
      calls.push(arguments_);
      return Buffer.from(arguments_[0] === "diff"
        ? "release-owned.txt\0renamed.txt\0"
        : "unexpected-verification-output.json\0");
    },
  }).sort();
  assert.equal(calls[0][0], "diff");
  assert.ok(calls[0].includes("--no-renames"));
  assert.deepEqual(calls[1], ["ls-files", "--others", "--exclude-standard", "-z"]);
  assert.deepEqual(paths, ["release-owned.txt", "renamed.txt", "unexpected-verification-output.json"]);
  assert.throws(() => assertGeneratedReleasePaths(paths), /managed release paths/u);
});

test("derives a deterministic marker and App-authored PR identity", () => {
  const input = inputFor();
  const baseCommit = "a".repeat(40);
  const tree = "b".repeat(40);
  const marker = createPreparationMarker({ baseCommit, tree, inputSha256: input.inputSha256 });
  const expected = createPreparationPullRequest({ input, baseCommit, tree });
  assert.match(marker, /vireo-template-release-preparation-v1/u);
  assert.equal(expected.branch, "automation/template-release-0.8.8");
  assert.equal(expected.body.startsWith(marker), true);
  assert.match(expected.body, /one-shot guarded reconciliation after exact checks/u);
  assert.doesNotMatch(expected.body, /not auto-merged/u);
  const pullRequest = {
    number: 123,
    state: "OPEN",
    headRefName: expected.branch,
    baseRefName: "main",
    headRefOid: "c".repeat(40),
    author: { login: "vireo-release-automation[bot]" },
    title: expected.title,
    body: expected.body,
  };
  assert.deepEqual(
    validateExistingPreparationPullRequests({ pullRequests: [pullRequest], expected, appSlug: "vireo-release-automation", expectedHead: "c".repeat(40) }),
    { action: "reuse", number: 123 },
  );
  assert.throws(
    () => validateExistingPreparationPullRequests({ pullRequests: [{ ...pullRequest, body: `${pullRequest.body}\nchanged` }], expected, appSlug: "vireo-release-automation", expectedHead: "c".repeat(40) }),
    /exact untouched App-authored/u,
  );
  assert.throws(
    () => validateExistingPreparationPullRequests({ pullRequests: [{ ...pullRequest, headRefOid: "d".repeat(40) }], expected, appSlug: "vireo-release-automation", expectedHead: "c".repeat(40) }),
    /exact untouched App-authored/u,
  );
});
