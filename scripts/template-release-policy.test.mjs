import assert from "node:assert/strict";
import test from "node:test";
import {
  readTemplateReleaseInputs,
  hasTemplateReleaseCoordinateChange,
  resolveTemplateReleaseTag,
  validateTemplateRelease,
  validateTemplateReleaseCoordinates,
} from "./template-release-policy.mjs";
import {
  createTemplateReleaseManifest,
  createPreparedTemplateReleaseManifest,
  resolveReleaseManifestOutput,
} from "./write-template-release-manifest.mjs";
import {
  artifactMavenModules,
  artifactNpmPackages,
  canonicalMavenGroup,
  createPreparedArtifactBinding,
  requiredArtifactFiles,
} from "./template-release-artifacts.mjs";

const policy = {
  schemaVersion: 1,
  version: "0.8.7",
  tag: "starter-template@0.8.7",
  createVireoVersion: "0.8.7",
  ecosystemRelease: "npm-0.8.7_jvm-0.3.1",
  repository: "vireocodedev/vireo-template",
  releaseUrl:
    "https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%400.8.7",
  immutableReleasesRequired: true,
};
const validInputs = {
  policy,
  packageJson: {
    name: "starter-template",
    private: true,
    version: policy.version,
    scripts: { vireo: "npx --yes --package=create-vireo@0.8.7 vireo" },
  },
  template: {
    schemaVersion: 1,
    profile: "full-stack",
    template: policy.repository,
    version: policy.version,
    tag: policy.tag,
    createVireoVersion: policy.createVireoVersion,
    ecosystemRelease: policy.ecosystemRelease,
  },
  compatibility: { schemaVersion: 1, id: "vireo-template-0.8.7" },
  starterVersion: "0.3.1",
};

test("validates canonical template release coordinates", () => {
  assert.deepEqual(validateTemplateRelease({ ...validInputs }), []);
  assert.deepEqual(
    validateTemplateRelease({ ...validInputs, tag: undefined }),
    [],
  );
  assert.deepEqual(
    validateTemplateRelease({ ...validInputs, tag: policy.tag }),
    [],
  );
});

test("detects semantic release-coordinate changes but ignores JSON field ordering", () => {
  assert.equal(hasTemplateReleaseCoordinateChange(policy, { ...policy }), false);
  assert.equal(
    hasTemplateReleaseCoordinateChange(policy, { ...policy, version: "0.8.8" }),
    true,
  );
});

test("resolves only explicit tags and GitHub tag refs", () => {
  assert.equal(
    resolveTemplateReleaseTag({
      explicitTag: policy.tag,
      environment: {
        GITHUB_REF_NAME: "11/merge",
        GITHUB_REF_TYPE: "branch",
      },
    }),
    policy.tag,
  );
  assert.ok(
    validateTemplateRelease({
      ...validInputs,
      tag: resolveTemplateReleaseTag({ explicitTag: "starter-template@0.5.0" }),
    }).length > 0,
  );
  assert.equal(
    resolveTemplateReleaseTag({
      environment: { GITHUB_REF_NAME: policy.tag, GITHUB_REF_TYPE: "tag" },
    }),
    policy.tag,
  );
  assert.equal(
    resolveTemplateReleaseTag({
      environment: { GITHUB_REF: `refs/tags/${policy.tag}` },
    }),
    policy.tag,
  );
  assert.equal(
    resolveTemplateReleaseTag({
      environment: {
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REF_NAME: "11/merge",
        GITHUB_REF: "refs/pull/11/merge",
      },
    }),
    undefined,
  );
  assert.equal(
    resolveTemplateReleaseTag({
      environment: {
        GITHUB_REF_NAME: "main",
        GITHUB_REF_TYPE: "branch",
        GITHUB_REF: "refs/heads/main",
      },
    }),
    undefined,
  );
});

test("rejects each release-coordinate mismatch", () => {
  for (const [field, value] of [
    ["schemaVersion", 2],
    ["version", "1.0.0"],
    ["tag", "starter-template@0.5.0"],
    ["createVireoVersion", "0.5.0"],
    ["ecosystemRelease", "npm-0.5.0_jvm-0.3.1"],
    ["repository", "example/template"],
    ["releaseUrl", "https://example.test/release"],
    ["immutableReleasesRequired", false],
  ]) {
    const problems = validateTemplateReleaseCoordinates({
      ...policy,
      [field]: value,
    });
    assert.ok(problems.length > 0, `${field} must be rejected`);
  }
});

test("rejects every local coordinate drift and a supplied tag mismatch", () => {
  for (const [key, value] of [
    ["packageJson", { ...validInputs.packageJson, name: "other" }],
    ["packageJson", { ...validInputs.packageJson, private: false }],
    ["packageJson", { ...validInputs.packageJson, version: "0.5.0" }],
    ["packageJson", { ...validInputs.packageJson, scripts: {} }],
    ["template", { ...validInputs.template, version: "0.5.0" }],
    ["template", { ...validInputs.template, tag: "starter-template@0.5.0" }],
    ["template", { ...validInputs.template, createVireoVersion: "0.5.0" }],
    [
      "template",
      { ...validInputs.template, ecosystemRelease: "npm-0.5.0_jvm-0.3.1" },
    ],
    ["template", { ...validInputs.template, schemaVersion: 2 }],
    ["template", { ...validInputs.template, profile: "frontend" }],
    ["template", { ...validInputs.template, template: "example/template" }],
    ["compatibility", { schemaVersion: 1, id: "vireo-template-0.5.0" }],
    ["compatibility", { schemaVersion: 2, id: validInputs.compatibility.id }],
    ["starterVersion", "0.2.0"],
  ]) {
    assert.ok(
      validateTemplateRelease({ ...validInputs, [key]: value }).length > 0,
    );
  }
  assert.ok(
    validateTemplateRelease({ ...validInputs, tag: "starter-template@0.5.0" })
      .length > 0,
  );
});

test("reads and binds the Gradle starter baseline to the advertised JVM coordinate", () => {
  const inputs = readTemplateReleaseInputs();
  assert.equal(inputs.starterVersion, "0.4.0");
  assert.deepEqual(validateTemplateRelease({ ...inputs }), []);
});

test("creates a deterministic manifest and rejects unsafe release inputs", () => {
  const commit = "a".repeat(40);
  assert.deepEqual(createTemplateReleaseManifest({ policy, commit }), {
    schemaVersion: 1,
    ...policy,
    commit,
  });
  for (const invalidCommit of [undefined, "A".repeat(40), "a".repeat(39)]) {
    assert.throws(() =>
      createTemplateReleaseManifest({ policy, commit: invalidCommit }),
    );
  }
  assert.throws(() => resolveReleaseManifestOutput({ output: "" }));
  assert.throws(() =>
    resolveReleaseManifestOutput({
      output: "release-manifest.json",
      root: "/repo",
    }),
  );
  assert.equal(
    resolveReleaseManifestOutput({
      output: "/tmp/release-manifest.json",
      root: "/repo",
    }),
    "/tmp/release-manifest.json",
  );
});

test("binds prepared npm and Maven release evidence into schema 2 manifests", () => {
  const artifacts = {
    schemaVersion: 1,
    prepared: true,
    templateVersion: policy.version,
    createVireoVersion: policy.createVireoVersion,
    npm: Object.fromEntries(
      artifactNpmPackages.map((name) => [
        name,
        { version: "0.3.1", integrity: "sha512-test", tarball: `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-0.3.1.tgz`, attestation: "https://registry.npmjs.org/-/npm/v1/attestations/test", attestationBundleSha256: "c".repeat(64) },
      ]),
    ),
    maven: {
      group: canonicalMavenGroup,
      version: "0.3.1",
      modules: Object.fromEntries(
        artifactMavenModules.map((name) => [name, { sha256: "a".repeat(64), signatureSha256: "b".repeat(64) }]),
      ),
    },
  };
  const binding = createPreparedArtifactBinding({ ...artifacts, files: Object.fromEntries(requiredArtifactFiles.map((path) => [path, "c".repeat(64)])) });
  const manifest = createPreparedTemplateReleaseManifest({ policy, commit: "a".repeat(40), artifacts: binding });
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.artifacts.npm["@vireocodedev/ui"].version, "0.3.1");
  assert.match(manifest.artifacts.coordinateDigest, /^[0-9a-f]{64}$/u);
});
