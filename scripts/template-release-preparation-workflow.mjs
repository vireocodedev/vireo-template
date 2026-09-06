import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  npmPackages,
  parseNpmVersionsJson,
  releasePreparationGeneratedPaths,
  validateReleasePrepareInput,
} from "./template-release-prepare.mjs";

const releaseVersionPattern = /^0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const markerSchema = "vireo-template-release-preparation-v1";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`unexpected workflow preparation argument: ${key}`);
    const value = argv[++index];
    if (value === undefined) throw new Error(`${key} requires a value`);
    const normalized = key.slice(2).replaceAll("-", "_");
    if (options[normalized] !== undefined) throw new Error(`${key} must be specified exactly once`);
    options[normalized] = value;
  }
  return options;
}

export function parseTemplatePreparationWorkflowInput(options) {
  const releaseVersion = options.release_version;
  const jvmVersion = options.jvm_version;
  if (!releaseVersionPattern.test(releaseVersion ?? ""))
    throw new Error("release_version must be strict 0.x semver");
  if (!releaseVersionPattern.test(jvmVersion ?? ""))
    throw new Error("jvm_version must be strict 0.x semver");
  if (typeof options.npm_versions !== "string")
    throw new Error("npm_versions must be a JSON object containing exactly seven Vireo library versions");
  const npm = parseNpmVersionsJson(options.npm_versions);
  const input = {
    templateVersion: releaseVersion,
    createVireoVersion: releaseVersion,
    jvmVersion,
    npm,
  };
  const { problems, npm: npmVersions } = validateReleasePrepareInput(input);
  if (problems.length) throw new Error(problems.join("; "));
  const canonicalNpmVersions = Object.fromEntries(npmPackages.map((name) => [name, npmVersions[name]]));
  const canonicalInput = {
    releaseVersion,
    jvmVersion,
    npmVersions: canonicalNpmVersions,
  };
  return {
    ...input,
    npmVersions: canonicalNpmVersions,
    inputSha256: sha256(stableJson(canonicalInput)),
  };
}

export function assertGeneratedReleasePaths(paths) {
  const actual = [...new Set(paths)].sort();
  const expected = new Set(releasePreparationGeneratedPaths);
  // A prior, necessary out-of-band dependency bump (e.g. landing a feature that
  // required the new Starter version to compile before this release existed)
  // can leave some managed paths already at their target value, so they show
  // no diff here. Accept any non-empty subset of the managed set; reject only
  // paths outside it, which would mean an unrelated file leaked into the PR.
  const unexpected = actual.filter(path => !expected.has(path));
  if (actual.length === 0 || unexpected.length > 0)
    throw new Error(
      `release preparation must change only the managed release paths: expected a non-empty subset of ${[...expected].sort().join(", ")}; received ${actual.join(", ")}`,
    );
  return actual;
}

export function createPreparationMarker({ baseCommit, tree, inputSha256 }) {
  if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? "")) throw new Error("base commit must be a lowercase 40-hex SHA");
  if (!/^[0-9a-f]{40}$/u.test(tree ?? "")) throw new Error("prepared tree must be a lowercase 40-hex SHA");
  if (!/^[0-9a-f]{64}$/u.test(inputSha256 ?? "")) throw new Error("input digest must be a lowercase 64-hex SHA");
  return `<!-- ${markerSchema} base=${baseCommit} tree=${tree} input=${inputSha256} -->`;
}

export function createPreparationPullRequest({ input, baseCommit, tree }) {
  const marker = createPreparationMarker({ baseCommit, tree, inputSha256: input.inputSha256 });
  const branch = `automation/template-release-${input.templateVersion}`;
  const title = `chore(release): prepare starter-template@${input.templateVersion}`;
  const body = `${marker}\n\nPrepared from public Vireo npm/JVM artifacts after hosted full Template verification.\n\n- Template and create-vireo: \`${input.templateVersion}\`\n- JVM: \`${input.jvmVersion}\`\n- Input digest: \`${input.inputSha256}\`\n\nThis PR is eligible only for one-shot guarded reconciliation after exact checks.`;
  return { branch, title, body, marker };
}

export function validateExistingPreparationPullRequests({ pullRequests, expected, appSlug, expectedHead }) {
  if (!Array.isArray(pullRequests)) throw new Error("GitHub pull request query must return an array");
  if (pullRequests.length === 0) return { action: "create" };
  if (pullRequests.length !== 1) throw new Error("exactly one automation pull request may exist for the deterministic branch");
  const [pullRequest] = pullRequests;
  const expectedAuthor = `${appSlug}[bot]`;
  if (
    pullRequest.state !== "OPEN" ||
    pullRequest.headRefName !== expected.branch ||
    pullRequest.baseRefName !== "main" ||
    pullRequest.headRefOid !== expectedHead ||
    pullRequest.author?.login !== expectedAuthor ||
    pullRequest.title !== expected.title ||
    pullRequest.body !== expected.body ||
    !pullRequest.body?.includes(expected.marker)
  ) throw new Error("existing automation pull request is not the exact untouched App-authored preparation result");
  return { action: "reuse", number: pullRequest.number };
}

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...options }).trim();
}

function gitBytes(args, options = {}) {
  return Buffer.from(execFileSync("git", args, options));
}

function nulPaths(bytes) {
  return bytes.toString("utf8").split("\0").filter(Boolean);
}

export function completeWorkingTreePaths({ baseCommit, repositoryRoot, runner = gitBytes } = {}) {
  if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? ""))
    throw new Error("base commit must be a lowercase 40-hex SHA");
  const options = repositoryRoot ? { cwd: repositoryRoot } : {};
  // --no-renames intentionally exposes both sides of a rename. A preparation
  // never owns path moves, so either side must make the fixed-path check fail.
  const tracked = nulPaths(runner(["diff", "--name-only", "-z", "--no-renames", baseCommit], options));
  // git diff omits untracked files, while git add --all would include them. Read
  // the same non-ignored population before staging so verification output cannot
  // silently enter the App-authored commit.
  const untracked = nulPaths(runner(["ls-files", "--others", "--exclude-standard", "-z"], options));
  return [...new Set([...tracked, ...untracked])];
}

function writeWorkingTree(baseCommit) {
  const indexDirectory = mkdtempSync(join(tmpdir(), "vireo-template-preparation-index-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(indexDirectory, "index") };
    git(["read-tree", baseCommit], { env });
    git(["add", "--all"], { env });
    return git(["write-tree"], { env });
  } finally {
    rmSync(indexDirectory, { recursive: true, force: true });
  }
}

function writeEvidence({ output, baseCommit, input }) {
  if (git(["rev-parse", "HEAD"]) !== baseCommit)
    throw new Error("release preparation evidence must be created from the exact checked-out main commit");
  const paths = assertGeneratedReleasePaths(completeWorkingTreePaths({ baseCommit }));
  const tree = writeWorkingTree(baseCommit);
  const pullRequest = createPreparationPullRequest({ input, baseCommit, tree });
  writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, baseCommit, tree, paths, input, pullRequest }, null, 2)}\n`);
}

function assertEvidence({ evidencePath, baseCommit, input }) {
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  if (evidence.schemaVersion !== 1 || evidence.baseCommit !== baseCommit || stableJson(evidence.input) !== stableJson(input))
    throw new Error("prepared release evidence does not bind the requested input and exact main base");
  assertGeneratedReleasePaths(evidence.paths ?? []);
  const expectedPullRequest = createPreparationPullRequest({ input, baseCommit, tree: evidence.tree });
  if (stableJson(evidence.pullRequest) !== stableJson(expectedPullRequest))
    throw new Error("prepared release evidence does not bind its deterministic branch and pull request marker");
  if (git(["rev-parse", "HEAD"]) !== baseCommit)
    throw new Error("mutation job must start from the exact verified main commit");
  return evidence;
}

function assertWorkingTree({ baseCommit, expectedTree }) {
  assertGeneratedReleasePaths(completeWorkingTreePaths({ baseCommit }));
  const tree = writeWorkingTree(baseCommit);
  if (tree !== expectedTree) throw new Error("prepared patch tree differs from the fully verified release tree");
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  const options = readOptions(argv);
  const input = parseTemplatePreparationWorkflowInput(options);
  if (command === "validate-input") {
    process.stdout.write(`${JSON.stringify(input)}\n`);
    return;
  }
  if (command === "write-evidence") {
    if (!options.output || !options.base_commit) throw new Error("write-evidence requires --output and --base-commit");
    writeEvidence({ output: resolve(options.output), baseCommit: options.base_commit, input });
    return;
  }
  if (command === "assert-evidence") {
    if (!options.evidence || !options.base_commit) throw new Error("assert-evidence requires --evidence and --base-commit");
    const evidence = assertEvidence({ evidencePath: resolve(options.evidence), baseCommit: options.base_commit, input });
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    return;
  }
  if (command === "assert-working-tree") {
    if (!options.base_commit || !options.expected_tree) throw new Error("assert-working-tree requires --base-commit and --expected-tree");
    assertWorkingTree({ baseCommit: options.base_commit, expectedTree: options.expected_tree });
    return;
  }
  if (command === "assert-generated-paths") {
    if (!options.base_commit) throw new Error("assert-generated-paths requires --base-commit");
    assertGeneratedReleasePaths(completeWorkingTreePaths({ baseCommit: options.base_commit }));
    return;
  }
  if (command === "assert-existing-pr") {
    if (!options.pull_requests || !options.base_commit || !options.tree || !options.app_slug || !options.expected_head)
      throw new Error("assert-existing-pr requires --pull-requests, --base-commit, --tree, --app-slug, and --expected-head");
    const expected = createPreparationPullRequest({ input, baseCommit: options.base_commit, tree: options.tree });
    const result = validateExistingPreparationPullRequests({
      pullRequests: JSON.parse(readFileSync(options.pull_requests, "utf8")),
      expected,
      appSlug: options.app_slug,
      expectedHead: options.expected_head,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  throw new Error("usage: template-release-preparation-workflow.mjs validate-input|write-evidence|assert-evidence|assert-generated-paths|assert-working-tree|assert-existing-pr OPTIONS");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main();
