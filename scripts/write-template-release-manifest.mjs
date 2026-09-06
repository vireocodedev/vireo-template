import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readTemplateReleaseInputs,
  validateTemplateReleaseCoordinates,
} from "./template-release-policy.mjs";
import { validateArtifactCoordinateBinding, validateArtifactFileDigests, validatePreparedArtifactBinding } from "./template-release-artifacts.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createTemplateReleaseManifest({ policy, commit }) {
  const problems = validateTemplateReleaseCoordinates(policy);
  if (problems.length > 0)
    throw new Error(`Invalid template release policy: ${problems.join("; ")}`);
  if (!/^[0-9a-f]{40}$/u.test(commit ?? ""))
    throw new Error(
      "release manifest commit must be a lowercase 40-hex Git SHA",
    );

  return { schemaVersion: 1, ...policy, commit };
}

export function createPreparedTemplateReleaseManifest({ policy, commit, artifacts }) {
  const manifest = createTemplateReleaseManifest({ policy, commit });
  if (artifacts?.prepared !== true) return manifest;
  const problems = validatePreparedArtifactBinding(artifacts, { version: policy.version });
  if (problems.length) throw new Error(problems.join("; "));
  return {
    ...manifest,
    schemaVersion: 2,
    artifacts: {
      mavenGroup: artifacts.mavenGroup,
      npm: artifacts.npm,
      maven: artifacts.maven,
      files: artifacts.files,
      coordinateDigest: artifacts.coordinateDigest,
      fileDigest: artifacts.fileDigest,
    },
  };
}

export function resolveReleaseManifestOutput({
  output,
  root = repositoryRoot,
}) {
  if (typeof output !== "string" || output.trim() === "")
    throw new Error("release manifest output path is required");
  const resolvedOutput = resolve(root, output);
  const relation = relative(root, resolvedOutput);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation)))
    throw new Error("release manifest output must be outside the repository");
  return resolvedOutput;
}

export function writeTemplateReleaseManifest({ output, policy, commit, root = repositoryRoot }) {
  const resolvedOutput = resolveReleaseManifestOutput({ output, root });
  const artifactPath = join(root, "contracts/template-release-artifacts.json");
  const artifacts = JSON.parse(readFileSync(artifactPath, "utf8"));
  const fileProblems = artifacts.prepared === true
    ? validateArtifactFileDigests(artifacts, { repositoryRoot: root })
    : [];
  if (fileProblems.length) throw new Error(fileProblems.join("; "));
  const coordinateProblems = artifacts.prepared === true
    ? validateArtifactCoordinateBinding(artifacts, {
      policy,
      readFile: (path) => readFileSync(join(root, path)),
    })
    : [];
  if (coordinateProblems.length) throw new Error(coordinateProblems.join("; "));
  const manifest = createPreparedTemplateReleaseManifest({ policy, commit, artifacts });
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function isMainModule() {
  return (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  writeTemplateReleaseManifest({
    output: process.argv[2],
    policy: readTemplateReleaseInputs().policy,
    commit: process.argv[3] ?? process.env.GITHUB_SHA,
  });
}
