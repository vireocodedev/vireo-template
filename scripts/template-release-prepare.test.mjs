import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  applyReleasePreparation,
  createReleasePreparationPlan,
  npmPackages,
  parseReleasePrepareArgs,
  preflightPublicArtifacts,
  regenerateLockfile,
  sanitizedEnvironment,
  validateReleasePrepareInput,
  verifyNpmAttestationBundles,
  verifyVireoMavenPomSignature,
} from "./template-release-prepare.mjs";
import {
  artifactMavenModules,
  canonicalMavenGroup,
  createPreparedArtifactBinding,
  requiredArtifactFiles,
} from "./template-release-artifacts.mjs";

const npm = [
  "@vireocodedev/history@0.2.3",
  "@vireocodedev/infrastructure@0.2.3",
  "@vireocodedev/localization@0.2.3",
  "@vireocodedev/query@0.2.3",
  "@vireocodedev/shell@0.2.3",
  "@vireocodedev/sqlite@0.2.4",
  "@vireocodedev/ui@0.3.2",
];
const input = { templateVersion: "0.9.1", createVireoVersion: "0.9.1", jvmVersion: "0.3.2", npm };
const npmCoordinates = Object.fromEntries(npm.map((coordinate) => {
  const [name, version] = coordinate.lastIndexOf("@") === 0
    ? [coordinate.slice(0, coordinate.lastIndexOf("@")), coordinate.slice(coordinate.lastIndexOf("@") + 1)]
    : [coordinate.slice(0, coordinate.lastIndexOf("@")), coordinate.slice(coordinate.lastIndexOf("@") + 1)];
  return [name, {
    version,
    tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`,
    integrity: "sha512-test",
    attestation: "https://registry.npmjs.org/-/npm/v1/attestations/test",
    attestationBundleSha256: "c".repeat(64),
  }];
}));
const artifacts = {
  npm: npmCoordinates,
  maven: {
    group: canonicalMavenGroup,
    version: input.jvmVersion,
    modules: Object.fromEntries(artifactMavenModules.map((name) => [name, { sha256: "a".repeat(64), signatureSha256: "b".repeat(64) }])),
  },
};

test("parses explicit apply/json flags while defaulting to a preflight dry run", () => {
  assert.deepEqual(parseReleasePrepareArgs([]), { npm: [], apply: false, json: false, preflight: true });
  assert.deepEqual(parseReleasePrepareArgs(["--apply", "--json", "--no-preflight"]), { npm: [], apply: true, json: true, preflight: false });
  assert.deepEqual(
    parseReleasePrepareArgs(["--npm-json", JSON.stringify({ "@vireocodedev/history": "0.2.3" })]).npm,
    ["@vireocodedev/history@0.2.3"],
  );
  assert.throws(
    () => parseReleasePrepareArgs(["--npm", "@vireocodedev/history@0.2.3", "--npm-json", "{}"]),
    /cannot be combined/u,
  );
});

test("requires strict coordinated versions and exactly seven unique npm coordinates", () => {
  assert.deepEqual(validateReleasePrepareInput(input).problems, []);
  assert.ok(validateReleasePrepareInput({ ...input, templateVersion: "1.0.0" }).problems.length);
  assert.ok(validateReleasePrepareInput({ ...input, npm: npm.slice(1) }).problems.length);
  assert.ok(validateReleasePrepareInput({ ...input, npm: [...npm, npm[0]] }).problems.length);
});

test("refuses downgrades, skipped successors, and same-version requests without exact prepared evidence", () => {
  assert.throws(() => createReleasePreparationPlan({ input: { ...input, templateVersion: "0.8.9", createVireoVersion: "0.8.9" }, artifacts }), /direct strict successor/);
  assert.throws(() => createReleasePreparationPlan({ input: { ...input, templateVersion: "0.9.0", createVireoVersion: "0.9.0" }, artifacts }), /same-version/);
});

test("refuses a self-consistent same-version artifact binding with tampered dependency coordinates", () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "vireo-same-version-binding-"));
  const currentNpm = Object.fromEntries(npmPackages.map((name) => {
    const version = name === "@vireocodedev/sqlite" ? "0.2.3" : name === "@vireocodedev/ui" ? "0.3.1" : "0.2.2";
    return [name, { version, tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`, integrity: "sha512-test", attestation: "https://registry.npmjs.org/-/npm/v1/attestations/test", attestationBundleSha256: "c".repeat(64) }];
  }));
  const policy = { schemaVersion: 1, version: "0.8.7", tag: "starter-template@0.8.7", createVireoVersion: "0.8.7", ecosystemRelease: "npm-0.8.7_jvm-0.3.1", repository: "vireocodedev/vireo-template", releaseUrl: "https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%400.8.7", immutableReleasesRequired: true };
  const direct = npmPackages.filter((name) => name !== "@vireocodedev/sqlite");
  const files = {
    "contracts/template-release-policy.json": JSON.stringify(policy),
    ".vireo/template.json": "{}",
    "package.json": JSON.stringify({ version: "0.8.7" }),
    "frontend/package.json": JSON.stringify({ dependencies: Object.fromEntries(direct.map((name) => [name, `^${currentNpm[name].version}`])) }),
    "frontend/package-lock.json": JSON.stringify({ packages: Object.fromEntries(direct.map((name) => [`node_modules/${name}`, { version: currentNpm[name].version, integrity: "sha512-test" }])) }),
    "gradle.properties": "starterVersion=0.3.1\n",
    "contracts/vireo-package-compatibility.json": JSON.stringify({ packages: { ...Object.fromEntries(npmPackages.map((name) => [name, [`^${currentNpm[name].version}`]])), "@vireocodedev/history": ["^0.2.3"] }, lockedPackages: Object.fromEntries(direct.map((name) => [name, currentNpm[name].version])) }),
    "contracts/project-upgrade-policy.json": "{}",
  };
  try {
    for (const [path, content] of Object.entries(files)) { mkdirSync(join(repositoryRoot, dirname(path)), { recursive: true }); writeFileSync(join(repositoryRoot, path), content); }
    const artifactBinding = createPreparedArtifactBinding({ templateVersion: "0.8.7", createVireoVersion: "0.8.7", npm: currentNpm, maven: { group: canonicalMavenGroup, version: "0.3.1", modules: Object.fromEntries(artifactMavenModules.map((name) => [name, { sha256: "a".repeat(64), signatureSha256: "b".repeat(64) }])) }, files: Object.fromEntries(Object.entries(files).map(([path, content]) => [path, createHash("sha256").update(content).digest("hex")])) });
    writeFileSync(join(repositoryRoot, "contracts/template-release-artifacts.json"), JSON.stringify(artifactBinding));
    assert.throws(() => createReleasePreparationPlan({ repositoryRoot, input: { templateVersion: "0.8.7", createVireoVersion: "0.8.7", jvmVersion: "0.3.1", npm: npmPackages.map((name) => `${name}@${currentNpm[name].version}`) } }), /same-version/);
  } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
});

test("creates a deterministic no-write coordinate plan and preserves historical upgrade evidence", () => {
  assert.ok(requiredArtifactFiles.includes("gradle.properties"));
  const before = JSON.stringify(createReleasePreparationPlan({ input, artifacts: undefined }));
  const plan = createReleasePreparationPlan({ input, artifacts });
  assert.equal(JSON.stringify(createReleasePreparationPlan({ input, artifacts: undefined })), before);
  assert.equal(plan.action, "apply");
  assert.equal(
    plan.writes.some((write) => write.path === "README.md"),
    false,
    "the evergreen repository README must not be rewritten for each release",
  );
  assert.ok(plan.writes.some((write) => write.path === "contracts/project-upgrade-policy.json"));
  const upgrades = JSON.parse(plan.writes.find((write) => write.path === "contracts/project-upgrade-policy.json").content);
  assert.ok(upgrades.supportedEdges.some((edge) => edge.from === "0.8.7" && edge.to === "0.9.0" && edge.status === "historical"));
  assert.ok(upgrades.supportedEdges.some((edge) => edge.from === "0.9.0" && edge.to === "0.9.1" && edge.status === "supported"));
  assert.match(plan.writes.find((write) => write.path === "docs/project-upgrades.md").content, /The supported adjacent edge is 0\.9\.0-to-0\.9\.1\./u);
  const generatedCapabilities = plan.writes.find((write) => write.path === "docs/generated-capabilities.md").content;
  assert.match(generatedCapabilities, /historical\n0\.8\.7-to-0\.9\.0 transform/u);
  assert.match(generatedCapabilities, /supported adjacent 0\.9\.0-to-0\.9\.1 project upgrade/u);
  assert.deepEqual(plan.manualRequiredPaths, ["vireocodedev/vireo release projection and upgrade policy"]);
});

test("scrubs registry authentication from isolated lock regeneration environments", () => {
  const environment = sanitizedEnvironment({ PATH: "/bin", NPM_TOKEN: "secret", NODE_AUTH_TOKEN: "secret", NPM_CONFIG_USERCONFIG: "/tmp/secret", KEEP: "yes" });
  assert.deepEqual(environment, { PATH: "/bin" });
});

test("regenerates the lock only from an isolated planned frontend manifest", () => {
  let observed;
  const lock = regenerateLockfile({
    frontendPackageJson: JSON.stringify({ name: "planned", dependencies: {} }),
    runner: (_command, _arguments, options) => {
      observed = { manifest: JSON.parse(readFileSync(`${options.cwd}/package.json`, "utf8")), env: options.env };
    },
  });
  assert.equal(observed.manifest.name, "planned");
  assert.equal(observed.env.npm_config_registry, "https://registry.npmjs.org");
  assert.equal(observed.env.NPM_TOKEN, undefined);
  assert.notEqual(observed.env.HOME, process.env.HOME);
  assert.match(observed.env.npm_config_userconfig, /vireo-template-release-prepare-/u);
  assert.match(observed.env.npm_config_globalconfig, /vireo-template-release-prepare-/u);
  assert.notEqual(observed.env.npm_config_userconfig, observed.env.npm_config_globalconfig);
  assert.match(lock, /lockfileVersion/u);
});

test("requires the actual pinned signer fingerprint from GPG VALIDSIG output", () => {
  const fingerprint = "C8C362C561046CD11C0F0DE01174796DD298F009";
  const executor = (_command, arguments_) => {
    if (arguments_.includes("--with-colons")) return `fpr:::::::::${fingerprint}:\n`;
    if (arguments_.includes("--status-fd")) return `[GNUPG:] VALIDSIG ${fingerprint} 2026-01-01 0 4 0 1 10 00 ${fingerprint}\n`;
    return "";
  };
  assert.equal(verifyVireoMavenPomSignature({ pom: "pom", signature: "signature", executor }), true);
  assert.throws(() => verifyVireoMavenPomSignature({
    pom: "pom",
    signature: "signature",
    executor: (_command, arguments_) => arguments_.includes("--with-colons") ? `fpr:::::::::${fingerprint}:\n` : arguments_.includes("--status-fd") ? `[GNUPG:] VALIDSIG ${"A".repeat(40)}\n` : "",
  }), /pinned Vireo signing fingerprint/);
});

test("requires one nonempty exact npm attestation bundle per requested coordinate", () => {
  const verified = Object.entries(npmCoordinates).map(([name, evidence], index) => ({
    name,
    version: evidence.version,
    attestationBundles: [{ subject: `${name}@${evidence.version}`, bundle: `bundle-${index}` }],
  }));
  const runnerFor = (audit) => (_command, arguments_, options) => {
    assert.notEqual(options.env.npm_config_userconfig, options.env.npm_config_globalconfig);
    if (arguments_.includes("install")) {
      assert.ok(arguments_.includes("--ignore-scripts"));
      assert.ok(!arguments_.includes("--package-lock-only"));
      writeFileSync(`${options.cwd}/package-lock.json`, JSON.stringify({ packages: Object.fromEntries(Object.entries(npmCoordinates).map(([name, evidence]) => [`node_modules/${name}`, { version: evidence.version }])) }));
      return "";
    }
    assert.ok(!arguments_.includes("--package-lock-only"));
    return JSON.stringify(audit);
  };
  const evidence = verifyNpmAttestationBundles({ npm: npmCoordinates, runner: runnerFor({ verified }) });
  assert.equal(Object.keys(evidence).length, 7);
  assert.notEqual(evidence["@vireocodedev/history"].attestationBundleSha256, evidence["@vireocodedev/ui"].attestationBundleSha256);
  for (const invalid of [
    { verified: verified.filter((entry) => entry.name !== "@vireocodedev/history") },
    { verified: [...verified, verified[0]] },
    { verified: verified.map((entry, index) => index === 0 ? { ...entry, version: "0.9.9" } : entry) },
    { verified: verified.map((entry, index) => index === 0 ? { ...entry, attestationBundles: [] } : entry) },
  ]) assert.throws(() => verifyNpmAttestationBundles({ npm: npmCoordinates, runner: runnerFor(invalid) }), /exactly one nonempty bundle/);
});

test("refuses apply on a dirty worktree before writing", () => {
  assert.throws(
    () =>
      applyReleasePreparation({
        plan: { action: "apply", artifacts: { prepared: true }, writes: [] },
        regeneratedLockfile: "{}\n",
        git: () => " M frontend/package.json\n",
      }),
    /clean working tree/,
  );
});

test("requires preflight evidence and rolls back every write when a focused policy fails", () => {
  assert.throws(() => applyReleasePreparation({ plan: { action: "apply", writes: [] }, regeneratedLockfile: "{}\n", git: () => "" }), /completed live public preflight/);
  const repositoryRoot = mkdtempSync(join(tmpdir(), "vireo-release-rollback-"));
  const writes = requiredArtifactFiles
    .filter((path) => path !== "frontend/package-lock.json")
    .map((path) => {
      mkdirSync(join(repositoryRoot, dirname(path)), { recursive: true });
      return { path, content: "planned\n", sha256: "ignored" };
    });
  try {
    assert.throws(() => applyReleasePreparation({
      repositoryRoot,
      plan: { action: "apply", next: input.templateVersion, artifacts: { prepared: true, schemaVersion: 1, mavenGroup: canonicalMavenGroup, templateVersion: input.templateVersion, createVireoVersion: input.createVireoVersion, ...artifacts }, writes },
      regeneratedLockfile: "lock\n",
      git: () => "",
      postWriteValidators: [() => { throw new Error("focused policy failed"); }],
    }), /focused policy failed/);
    for (const write of writes) assert.equal(existsSync(join(repositoryRoot, write.path)), false);
    assert.equal(existsSync(join(repositoryRoot, "frontend/package-lock.json")), false);
    assert.equal(existsSync(join(repositoryRoot, "contracts/template-release-artifacts.json")), false);
  } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
});

test("uses only canonical anonymous npm and Maven endpoints during preflight", async () => {
  const urls = [];
  const artifacts = await preflightPublicArtifacts({
    input,
    verifyMavenSignature: () => true,
    verifyNpmAttestations: ({ npm: requested }) => Object.fromEntries(Object.entries(requested).map(([name, evidence]) => [name, { version: evidence.version, attestationBundleSha256: "c".repeat(64) }])),
    fetchImpl: async (url, options) => {
      urls.push({ url, options });
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === "https:" && parsedUrl.hostname === "registry.npmjs.org") {
        const [encodedName, version] = parsedUrl.pathname.slice(1).split("/");
        const name = decodeURIComponent(encodedName);
        return { ok: true, text: async () => JSON.stringify({ name, version, dist: { integrity: "sha512-test", tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`, attestations: { url: "https://registry.npmjs.org/-/npm/v1/attestations/test" } } }) };
      }
      if (url.endsWith(".sha256")) return { ok: true, text: async () => "55f288f60fbe15f17a05c8353a3ca453fe0269147f646383b99ae3a4d57e0994\n" };
      if (url.endsWith(".asc")) return { ok: true, text: async () => "signature" };
      return { ok: true, text: async () => "<project />" };
    },
  });
  assert.equal(Object.keys(artifacts.npm).length, 7);
  assert.equal(Object.keys(artifacts.maven.modules).length, 6);
  assert.equal(urls.length, 25);
  assert.ok(urls.every(({ url }) => url.startsWith("https://registry.npmjs.org/") || url.startsWith("https://repo1.maven.org/maven2/")));
  assert.ok(urls.every(({ options }) => !Object.keys(options.headers).some((key) => /auth|token/i.test(key))));
});
