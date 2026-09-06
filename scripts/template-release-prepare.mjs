import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  artifactMavenModules,
  artifactNpmPackages,
  canonicalMavenGroup,
  createPreparedArtifactBinding,
  digest as sha256,
  requiredArtifactFiles,
  validateArtifactCoordinateBinding,
  validateArtifactFileDigests,
  validatePreparedArtifactBinding,
} from "./template-release-artifacts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const npmPackages = artifactNpmPackages;
export const mavenModules = artifactMavenModules;
// This list is deliberately explicit: hosted preparation may create a PR only
// when release:prepare changed exactly these release-owned files.
export const releasePreparationGeneratedPaths = Object.freeze([
  ".vireo/template.json",
  "SECURITY.md",
  "SUPPORT.md",
  "contracts/project-upgrade-policy.json",
  "contracts/template-release-artifacts.json",
  "contracts/template-release-policy.json",
  "contracts/vireo-package-compatibility.json",
  "docs/generated-capabilities.md",
  "docs/project-upgrades.md",
  "docs/starter-compatibility.md",
  "frontend/package-lock.json",
  "frontend/package.json",
  "gradle.properties",
  "package.json",
]);
const versionPattern = /^0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const canonicalNpmRegistry = "https://registry.npmjs.org";
const canonicalMavenRepository = "https://repo1.maven.org/maven2";
const fetchAttempts = 2;
const fetchTimeoutMs = 10_000;
const maxResponseBytes = 1_000_000;
const vireoSigningFingerprint = "C8C362C561046CD11C0F0DE01174796DD298F009";

function compareVersion(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function isDirectSuccessor(previous, next) {
  const [, previousMinor, previousPatch] = previous.split(".").map(Number);
  const [, nextMinor, nextPatch] = next.split(".").map(Number);
  return (nextMinor === previousMinor && nextPatch === previousPatch + 1) ||
    (nextMinor === previousMinor + 1 && nextPatch === 0);
}

export function parseReleasePrepareArgs(argv) {
  const result = { npm: [], apply: false, json: false, preflight: true };
  let npmJsonSpecified = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") result.help = true;
    else if (value === "--apply") result.apply = true;
    else if (value === "--json") result.json = true;
    else if (value === "--no-preflight") result.preflight = false;
    else if (["--template-version", "--create-vireo-version", "--jvm-version", "--npm", "--npm-json"].includes(value)) {
      const argument = argv[++index];
      if (!argument) throw new Error(`${value} requires a value`);
      if (value === "--template-version") result.templateVersion = argument;
      if (value === "--create-vireo-version") result.createVireoVersion = argument;
      if (value === "--jvm-version") result.jvmVersion = argument;
      if (value === "--npm") {
        if (npmJsonSpecified) throw new Error("--npm cannot be combined with --npm-json");
        result.npm.push(argument);
      }
      if (value === "--npm-json") {
        if (result.npm.length) throw new Error("--npm-json cannot be combined with --npm");
        result.npm = parseNpmVersionsJson(argument);
        npmJsonSpecified = true;
      }
    } else throw new Error(`Unknown release preparation argument: ${value}`);
  }
  return result;
}

export function parseNpmVersionsJson(value) {
  let versions;
  try { versions = JSON.parse(value); }
  catch { throw new Error("--npm-json must be a JSON object of package names to versions"); }
  if (!versions || Array.isArray(versions) || typeof versions !== "object")
    throw new Error("--npm-json must be a JSON object of package names to versions");
  return Object.entries(versions).map(([name, version]) => `${name}@${version}`);
}

export function validateReleasePrepareInput(input) {
  const problems = [];
  for (const [label, version] of Object.entries({
    "template version": input.templateVersion,
    "create-vireo version": input.createVireoVersion,
    "JVM version": input.jvmVersion,
  })) if (!versionPattern.test(version ?? "")) problems.push(`${label} must be strict 0.x semver`);
  if (input.templateVersion !== input.createVireoVersion)
    problems.push("template and create-vireo versions must match");
  const coordinates = new Map();
  for (const coordinate of input.npm ?? []) {
    const match = coordinate.match(/^(@vireocodedev\/(?:history|infrastructure|localization|query|shell|sqlite|ui))@(0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/u);
    if (!match) { problems.push(`invalid Vireo npm coordinate: ${coordinate}`); continue; }
    if (coordinates.has(match[1])) problems.push(`duplicate Vireo npm coordinate: ${match[1]}`);
    coordinates.set(match[1], match[2]);
  }
  for (const name of npmPackages) if (!coordinates.has(name)) problems.push(`missing Vireo npm coordinate: ${name}`);
  for (const name of coordinates.keys()) if (!npmPackages.includes(name)) problems.push(`unexpected Vireo npm coordinate: ${name}`);
  return { problems, npm: Object.fromEntries([...coordinates.entries()].sort(([a], [b]) => a.localeCompare(b))) };
}

function readJson(repositoryRoot, path) {
  return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function replaceStrict(text, from, to, path) {
  if (!text.includes(from)) throw new Error(`${path} does not contain expected current coordinate ${from}`);
  return text.replaceAll(from, to);
}
function replaceCompatibilityRow(text, name, from, to) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(
    "(\\|\\s*`" + escaped + "`\\s*\\|\\s*)`" + escapedFrom + "`",
    "u",
  );
  if (!expression.test(text)) throw new Error(`docs/starter-compatibility.md does not contain ${name} ${from}`);
  return text.replace(expression, `$1\`${to}\``);
}

export function createReleasePreparationPlan({ repositoryRoot = root, input, artifacts } = {}) {
  const { problems, npm } = validateReleasePrepareInput(input);
  if (problems.length) throw new Error(problems.join("; "));
  const policy = readJson(repositoryRoot, "contracts/template-release-policy.json");
  const previous = policy.version;
  const packageJson = readJson(repositoryRoot, "package.json");
  const template = readJson(repositoryRoot, ".vireo/template.json");
  const compatibility = readJson(repositoryRoot, "contracts/vireo-package-compatibility.json");
  const upgrades = readJson(repositoryRoot, "contracts/project-upgrade-policy.json");
  const frontend = readJson(repositoryRoot, "frontend/package.json");
  const currentArtifacts = readJson(repositoryRoot, "contracts/template-release-artifacts.json");
  if (input.templateVersion === previous) {
    const expectedNpm = Object.fromEntries(
      npmPackages.map((name) => [name, compatibility.lockedPackages?.[name] ?? compatibility.packages?.[name]?.at(-1)?.replace(/^\^/u, "")]),
    );
    const currentJvm = policy.ecosystemRelease.match(/jvm-(.+)$/u)?.[1];
    const requestedMatchesCurrent =
      input.createVireoVersion === policy.createVireoVersion &&
      input.jvmVersion === currentJvm &&
      npmPackages.every((name) => npm[name] === expectedNpm[name]);
    const artifactProblems = validatePreparedArtifactBinding(currentArtifacts, { version: previous });
    const fileProblems = validateArtifactFileDigests(currentArtifacts, { repositoryRoot });
    const coordinateProblems = validateArtifactCoordinateBinding(currentArtifacts, {
      policy,
      readFile: (path) => readFileSync(join(repositoryRoot, path)),
    });
    if (!requestedMatchesCurrent || artifactProblems.length || fileProblems.length || coordinateProblems.length) {
      throw new Error("same-version release preparation requires exact current npm/JVM coordinates and prepared schema-2 artifact evidence");
    }
    return { action: "no-op", previous, next: previous, writes: [], manualRequiredPaths: [] };
  }
  if (compareVersion(input.templateVersion, previous) < 0 || !isDirectSuccessor(previous, input.templateVersion)) {
    throw new Error(`template version must be the direct strict successor of ${previous}`);
  }
  const nextTag = `starter-template@${input.templateVersion}`;
  const nextEcosystem = `npm-${input.createVireoVersion}_jvm-${input.jvmVersion}`;
  const writes = new Map();
  writes.set("package.json", json({ ...packageJson, version: input.templateVersion, scripts: { ...packageJson.scripts, vireo: `npx --yes --package=create-vireo@${input.createVireoVersion} vireo`, "release:prepare": "node scripts/template-release-prepare.mjs" } }));
  writes.set(".vireo/template.json", json({ ...template, version: input.templateVersion, tag: nextTag, createVireoVersion: input.createVireoVersion, ecosystemRelease: nextEcosystem }));
  writes.set("contracts/template-release-policy.json", json({ ...policy, version: input.templateVersion, tag: nextTag, createVireoVersion: input.createVireoVersion, ecosystemRelease: nextEcosystem, releaseUrl: `https://github.com/${policy.repository}/releases/tag/${encodeURIComponent(nextTag)}` }));
  const nextFrontend = structuredClone(frontend);
  for (const name of npmPackages) if (name in nextFrontend.dependencies) nextFrontend.dependencies[name] = `^${npm[name]}`;
  writes.set("frontend/package.json", json(nextFrontend));
  const nextCompatibility = structuredClone(compatibility);
  nextCompatibility.id = `vireo-template-${input.templateVersion}`;
  for (const name of npmPackages) nextCompatibility.packages[name] = [`^${npm[name]}`];
  for (const name of Object.keys(nextCompatibility.lockedPackages)) nextCompatibility.lockedPackages[name] = npm[name];
  writes.set("contracts/vireo-package-compatibility.json", json(nextCompatibility));
  const nextUpgrades = structuredClone(upgrades);
  nextUpgrades.publicRelease = input.templateVersion;
  nextUpgrades.previousRelease = previous;
  nextUpgrades.supportedEdges = nextUpgrades.supportedEdges.map((edge) => edge.status === "supported" ? { ...edge, status: "historical" } : edge);
  nextUpgrades.supportedEdges.push({ from: previous, to: input.templateVersion, status: "supported" });
  writes.set("contracts/project-upgrade-policy.json", json(nextUpgrades));
  writes.set("gradle.properties", replaceStrict(readFileSync(join(repositoryRoot, "gradle.properties"), "utf8"), `starterVersion=${policy.ecosystemRelease.match(/jvm-(.+)$/u)[1]}`, `starterVersion=${input.jvmVersion}`, "gradle.properties"));
  const currentEdge = `${upgrades.previousRelease}-to-${policy.version}`;
  const nextEdge = `${previous}-to-${input.templateVersion}`;
  for (const path of ["SUPPORT.md", "SECURITY.md", "docs/generated-capabilities.md"]) {
    let text = readFileSync(join(repositoryRoot, path), "utf8");
    text = replaceStrict(text, `starter-template@${previous}`, nextTag, path);
    if (text.includes(encodeURIComponent(`starter-template@${previous}`)))
      text = replaceStrict(text, encodeURIComponent(`starter-template@${previous}`), encodeURIComponent(nextTag), path);
    if (text.includes(`create-vireo@${policy.createVireoVersion}`))
      text = replaceStrict(text, `create-vireo@${policy.createVireoVersion}`, `create-vireo@${input.createVireoVersion}`, path);
    if (path === "docs/generated-capabilities.md") {
      text = replaceStrict(
        text,
        `and the supported\nadjacent ${currentEdge} project upgrade.`,
        `and the historical\n${currentEdge} transform, and the supported\nadjacent ${nextEdge} project upgrade.`,
        path,
      );
    }
    writes.set(path, text);
  }
  let compatibilityDoc = readFileSync(join(repositoryRoot, "docs/starter-compatibility.md"), "utf8");
  for (const name of Object.keys(nextFrontend.dependencies).filter((name) => npmPackages.includes(name))) compatibilityDoc = replaceCompatibilityRow(compatibilityDoc, name, compatibility.packages[name][0], `^${npm[name]}`);
  compatibilityDoc = replaceStrict(compatibilityDoc, `| \`0.${policy.ecosystemRelease.split("_jvm-")[1].split(".").slice(1).join(".")}\``, `| \`${input.jvmVersion}\``, "docs/starter-compatibility.md");
  writes.set("docs/starter-compatibility.md", compatibilityDoc);
  const projectUpgradeText = readFileSync(join(repositoryRoot, "docs/project-upgrades.md"), "utf8");
  const managedSection = "## Managed ";
  const managedIndex = projectUpgradeText.indexOf(managedSection);
  if (managedIndex < 0) throw new Error("docs/project-upgrades.md must retain managed migration evidence");
  let projectUpgradesDoc = projectUpgradeText.slice(0, managedIndex)
    .replace(`The supported adjacent edge is ${currentEdge}.`, `The supported adjacent edge is ${nextEdge}.`)
    .replaceAll(`create-vireo@${policy.createVireoVersion}`, `create-vireo@${input.createVireoVersion}`)
    .replaceAll(`--to ${previous}`, `--to ${input.templateVersion}`)
    .replace(`The ${previous} release is terminal until a later release declares its own\nadjacent edge.`, `The ${input.templateVersion} release is terminal until a later release declares its own\nadjacent edge.`);
  // The detailed section remains immutable historical migration evidence.
  projectUpgradesDoc += projectUpgradeText.slice(managedIndex);
  if (!projectUpgradesDoc.includes(`The supported adjacent edge is ${nextEdge}.`))
    throw new Error("docs/project-upgrades.md must declare the generated current supported edge");
  writes.set("docs/project-upgrades.md", projectUpgradesDoc);
  const preparedArtifacts = artifacts && {
    schemaVersion: 1,
    prepared: true,
    mavenGroup: canonicalMavenGroup,
    templateVersion: input.templateVersion,
    createVireoVersion: input.createVireoVersion,
    npm: artifacts.npm,
    maven: artifacts.maven,
  };
  if (preparedArtifacts) {
    const artifactProblems = validatePreparedArtifactBinding({
      ...preparedArtifacts,
      files: Object.fromEntries(requiredArtifactFiles.map((path) => [path, "0".repeat(64)])),
      coordinateDigest: "0".repeat(64),
    }, { version: input.templateVersion }).filter((problem) => !problem.includes("coordinateDigest") && !problem.includes("fileDigest"));
    if (artifactProblems.length) throw new Error(artifactProblems.join("; "));
  }
  return { action: "apply", previous, next: input.templateVersion, input: { ...input, npm }, artifacts: preparedArtifacts, writes: [...writes.entries()].map(([path, content]) => ({ path, sha256: sha256(content), content })), manualRequiredPaths: ["vireocodedev/vireo release projection and upgrade policy"] };
}

async function fetchCanonicalBytes({ url, accept, fetchImpl, attempts = fetchAttempts, timeoutMs = fetchTimeoutMs, maxBytes = maxResponseBytes }) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { accept },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response?.ok || response.redirected) throw new Error(`HTTP ${response?.status ?? "unknown"}`);
      let bytes;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let length = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) {
            await reader.cancel();
            throw new Error("response exceeds bounded preflight size");
          }
          chunks.push(Buffer.from(value));
        }
        bytes = Buffer.concat(chunks, length);
      } else {
        bytes = typeof response.arrayBuffer === "function"
          ? Buffer.from(await response.arrayBuffer())
          : Buffer.from(await response.text(), "utf8");
      }
      const advertisedLength = Number(response.headers?.get?.("content-length") ?? 0);
      if (advertisedLength > maxBytes || bytes.length > maxBytes) throw new Error("response exceeds bounded preflight size");
      return bytes;
    } catch (error) {
      failure = error;
      if (attempt === attempts) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`canonical public preflight failed for ${url}: ${failure?.message ?? "unknown failure"}`);
}

function canonicalNpmTarball(name, version) {
  return `${canonicalNpmRegistry}/${name}/-/${name.split("/").at(-1)}-${version}.tgz`;
}

export function verifyVireoMavenPomSignature({ pom, signature, executor = execFileSync, keyPath = join(root, "contracts/vireo-release-signing-key.asc") } = {}) {
  const signingHome = mkdtempSync(join(tmpdir(), "vireo-template-release-signing-"));
  try {
    const pomPath = join(signingHome, "artifact.pom");
    const signaturePath = `${pomPath}.asc`;
    writeFileSync(pomPath, pom);
    writeFileSync(signaturePath, signature);
    executor("gpg", ["--homedir", signingHome, "--batch", "--import", keyPath], { stdio: "pipe" });
    const fingerprints = executor("gpg", ["--homedir", signingHome, "--with-colons", "--fingerprint", vireoSigningFingerprint], { encoding: "utf8" });
    if (!fingerprints.includes(`fpr:::::::::${vireoSigningFingerprint}:`))
      throw new Error("checked-in Vireo signing key does not match the pinned fingerprint");
    const verificationStatus = executor("gpg", ["--homedir", signingHome, "--batch", "--status-fd", "1", "--verify", signaturePath, pomPath], { encoding: "utf8", stdio: "pipe" });
    const validSigner = String(verificationStatus).match(/^\[GNUPG:\] VALIDSIG ([A-F0-9]{40})\s/mu)?.[1];
    if (validSigner !== vireoSigningFingerprint)
      throw new Error("Maven POM signature was not made by the pinned Vireo signing fingerprint");
    return true;
  } finally {
    rmSync(signingHome, { recursive: true, force: true });
  }
}

export function verifyNpmAttestationBundles({ npm, runner = execFileSync } = {}) {
  const requested = Object.fromEntries(Object.entries(npm ?? {}).map(([name, evidence]) => [name, evidence?.version]));
  if (JSON.stringify(Object.keys(requested).sort()) !== JSON.stringify([...npmPackages].sort()))
    throw new Error("npm attestation audit requires exactly the seven Vireo library coordinates");
  const staging = mkdtempSync(join(tmpdir(), "vireo-template-npm-attestations-"));
  try {
    const home = join(staging, "home");
    const cache = join(staging, "npm-cache");
    const userConfig = join(staging, "user.npmrc");
    const globalConfig = join(staging, "global.npmrc");
    mkdirSync(home, { recursive: true });
    writeFileSync(userConfig, `registry=${canonicalNpmRegistry}/\ncache=${cache}\nignore-scripts=true\naudit=false\nfund=false\n`);
    writeFileSync(globalConfig, "");
    writeFileSync(join(staging, "package.json"), json({ name: "vireo-template-attestation-preflight", private: true, packageManager: "npm@12.0.2", dependencies: requested }));
    const env = { ...sanitizedEnvironment(), HOME: home, XDG_CONFIG_HOME: join(staging, "xdg-config"), npm_config_registry: canonicalNpmRegistry, npm_config_userconfig: userConfig, npm_config_globalconfig: globalConfig, npm_config_cache: cache };
    runner("corepack", ["npm@12.0.2", "install", "--ignore-scripts", "--no-audit", "--fund=false"], { cwd: staging, env, stdio: "pipe" });
    const lock = JSON.parse(readFileSync(join(staging, "package-lock.json"), "utf8"));
    for (const [name, version] of Object.entries(requested)) {
      if (lock.packages?.[`node_modules/${name}`]?.version !== version)
        throw new Error(`npm attestation audit lockfile did not resolve exact ${name}@${version}`);
    }
    const audit = runner("corepack", ["npm@12.0.2", "audit", "signatures", "--include-attestations", "--json"], { cwd: staging, env, encoding: "utf8", stdio: "pipe" });
    const auditText = String(audit ?? "");
    let auditEvidence;
    try { auditEvidence = JSON.parse(auditText || "{}"); }
    catch { throw new Error("npm attestation audit did not return JSON evidence"); }
    if (!Array.isArray(auditEvidence?.verified))
      throw new Error("npm attestation audit did not report verified package evidence");
    return Object.fromEntries(Object.entries(requested).map(([name, version]) => {
      const matches = auditEvidence.verified.filter((entry) => entry?.name === name && entry?.version === version);
      if (matches.length !== 1 || !Array.isArray(matches[0].attestationBundles) || matches[0].attestationBundles.length === 0)
        throw new Error(`npm attestation audit did not verify exactly one nonempty bundle for ${name}@${version}`);
      return [name, { version, attestationBundleSha256: sha256(stableJson(matches[0].attestationBundles)) }];
    }));
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export async function preflightPublicArtifacts({ input, fetchImpl = fetch, verifyMavenSignature = verifyVireoMavenPomSignature, verifyNpmAttestations = verifyNpmAttestationBundles } = {}) {
  const { problems, npm } = validateReleasePrepareInput(input);
  if (problems.length) throw new Error(problems.join("; "));
  const npmArtifacts = {};
  for (const name of npmPackages) {
    const metadataUrl = `${canonicalNpmRegistry}/${encodeURIComponent(name)}/${npm[name]}`;
    const payload = JSON.parse((await fetchCanonicalBytes({ url: metadataUrl, accept: "application/json", fetchImpl })).toString("utf8"));
    const tarball = canonicalNpmTarball(name, npm[name]);
    const attestation = payload.dist?.attestations?.url ?? payload.dist?.attestation?.url;
    if (payload.name !== name || payload.version !== npm[name] || payload.dist?.tarball !== tarball ||
      typeof payload.dist?.integrity !== "string" || !payload.dist.integrity.startsWith("sha512-") ||
      typeof attestation !== "string" || !attestation.startsWith("https://")) {
      throw new Error(`canonical npm metadata is incomplete or non-canonical for ${name}@${npm[name]}`);
    }
    npmArtifacts[name] = { version: npm[name], tarball, integrity: payload.dist.integrity, attestation };
  }
  const attestationBundles = verifyNpmAttestations({ npm: npmArtifacts });
  for (const name of npmPackages) {
    if (attestationBundles?.[name]?.version !== npmArtifacts[name].version || !/^[0-9a-f]{64}$/u.test(attestationBundles?.[name]?.attestationBundleSha256 ?? ""))
      throw new Error(`npm attestation audit did not bind exact ${name}@${npmArtifacts[name].version}`);
    npmArtifacts[name].attestationBundleSha256 = attestationBundles[name].attestationBundleSha256;
  }
  const maven = { group: canonicalMavenGroup, version: input.jvmVersion, modules: {} };
  for (const artifact of mavenModules) {
    const url = `${canonicalMavenRepository}/com/vireocode/${artifact}/${input.jvmVersion}/${artifact}-${input.jvmVersion}.pom`;
    const pom = await fetchCanonicalBytes({ url, accept: "application/xml", fetchImpl });
    const publishedDigest = (await fetchCanonicalBytes({ url: `${url}.sha256`, accept: "text/plain", fetchImpl })).toString("utf8").trim().split(/\s/u)[0];
    const signature = await fetchCanonicalBytes({ url: `${url}.asc`, accept: "application/pgp-signature", fetchImpl });
    const pomSha256 = sha256(pom);
    if (!/^[0-9a-f]{64}$/u.test(publishedDigest) || publishedDigest !== pomSha256) {
      throw new Error(`canonical Maven checksum does not match POM for ${artifact}:${input.jvmVersion}`);
    }
    verifyMavenSignature({ pom, signature });
    maven.modules[artifact] = { sha256: pomSha256, signatureSha256: sha256(signature) };
  }
  return { npm: npmArtifacts, maven };
}

export function sanitizedEnvironment(environment = process.env) {
  const allowed = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "CI", "SystemRoot", "ComSpec"];
  return Object.fromEntries(
    allowed.flatMap((key) => environment[key] === undefined ? [] : [[key, environment[key]]]),
  );
}

export function regenerateLockfile({ repositoryRoot = root, frontendPackageJson, runner = execFileSync } = {}) {
  const staging = mkdtempSync(join(tmpdir(), "vireo-template-release-prepare-"));
  try {
    const frontend = join(staging, "frontend");
    cpSync(join(repositoryRoot, "frontend"), frontend, { recursive: true, filter: (path) => !path.includes("node_modules") });
    if (frontendPackageJson) writeFileSync(join(frontend, "package.json"), frontendPackageJson);
    const userConfig = join(staging, "user.npmrc");
    const globalConfig = join(staging, "global.npmrc");
    const cache = join(staging, "npm-cache");
    const home = join(staging, "home");
    mkdirSync(home, { recursive: true });
    writeFileSync(userConfig, `registry=${canonicalNpmRegistry}/\ncache=${cache}\nignore-scripts=true\naudit=false\nfund=false\n`);
    writeFileSync(globalConfig, "");
    runner("corepack", ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--fund=false"], { cwd: frontend, env: { ...sanitizedEnvironment(), HOME: home, XDG_CONFIG_HOME: join(staging, "xdg-config"), npm_config_registry: canonicalNpmRegistry, npm_config_userconfig: userConfig, npm_config_cache: cache, npm_config_globalconfig: globalConfig }, stdio: "pipe" });
    return readFileSync(join(frontend, "package-lock.json"), "utf8");
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

function restoreWrites(repositoryRoot, previous) {
  for (const [path, content] of previous) {
    const destination = join(repositoryRoot, path);
    if (content === undefined && existsSync(destination)) unlinkSync(destination);
    else writeFileSync(destination, content);
  }
}

function defaultPostWriteValidators(repositoryRoot) {
  return [
    "scripts/template-release-policy.mjs",
    "scripts/vireo-package-compatibility-policy.mjs",
    "scripts/public-contract-policy.mjs",
  ].map((script) => () => execFileSync(process.execPath, [script], { cwd: repositoryRoot, stdio: "pipe" }));
}

export function applyReleasePreparation({ repositoryRoot = root, plan, regeneratedLockfile, git = execFileSync, postWriteValidators } = {}) {
  if (plan.action === "no-op") return plan;
  const dirty = git("git", ["status", "--porcelain"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  if (dirty) throw new Error("release preparation apply requires a clean working tree");
  if (!plan.artifacts?.prepared || !regeneratedLockfile) throw new Error("release preparation apply requires completed live public preflight and an isolated lockfile");
  const writes = [...plan.writes, { path: "frontend/package-lock.json", content: regeneratedLockfile, sha256: sha256(regeneratedLockfile) }];
  const byPath = new Map(writes.map((write) => [write.path, write.content]));
  const missingBoundFile = requiredArtifactFiles.find((path) => !byPath.has(path));
  if (missingBoundFile) throw new Error(`release preparation is missing required artifact-bound write: ${missingBoundFile}`);
  const artifactBinding = createPreparedArtifactBinding({
    ...plan.artifacts,
    files: Object.fromEntries(requiredArtifactFiles.map((path) => [path, sha256(byPath.get(path))])),
  });
  const artifactProblems = validatePreparedArtifactBinding(artifactBinding, { version: plan.next });
  if (artifactProblems.length) throw new Error(artifactProblems.join("; "));
  writes.push({ path: "contracts/template-release-artifacts.json", content: json(artifactBinding), sha256: sha256(json(artifactBinding)) });
  const previous = new Map(writes.map(({ path }) => [path, existsSync(join(repositoryRoot, path)) ? readFileSync(join(repositoryRoot, path), "utf8") : undefined]));
  try {
    for (const { path, content } of writes) writeFileSync(join(repositoryRoot, path), content);
    for (const validate of postWriteValidators?.length ? postWriteValidators : defaultPostWriteValidators(repositoryRoot))
      validate({ repositoryRoot, plan, artifactBinding });
  }
  catch (error) {
    restoreWrites(repositoryRoot, previous);
    throw error;
  }
  return { ...plan, writes: writes.map(({ path, sha256: digest }) => ({ path, sha256: digest })) };
}

function help() { return "Usage: corepack npm run release:prepare -- --template-version 0.x.y --create-vireo-version 0.x.y --jvm-version 0.x.y (--npm @vireocodedev/name@0.x.y ... | --npm-json '{\"@vireocodedev/history\":\"0.x.y\",...}') (exactly seven) [--json] [--apply] [--no-preflight]"; }
async function main() {
  const input = parseReleasePrepareArgs(process.argv.slice(2));
  if (input.help) { console.log(help()); return; }
  if (input.apply && !input.preflight) throw new Error("--apply requires completed live public preflight; --no-preflight is dry-run only");
  const initialPlan = createReleasePreparationPlan({ input });
  if (initialPlan.action === "no-op") {
    console.log(input.json ? JSON.stringify(initialPlan, null, 2) : `${initialPlan.action}: ${initialPlan.previous} -> ${initialPlan.next} (already prepared)`);
    return;
  }
  const artifacts = input.preflight ? await preflightPublicArtifacts({ input }) : undefined;
  const plan = createReleasePreparationPlan({ input, artifacts });
  const frontendPackageJson = plan.writes?.find((write) => write.path === "frontend/package.json")?.content;
  const result = input.apply ? applyReleasePreparation({ plan, regeneratedLockfile: regenerateLockfile({ frontendPackageJson }) }) : plan;
  console.log(input.json ? JSON.stringify(result, null, 2) : `${result.action}: ${result.previous} -> ${result.next}${input.apply ? "" : " (dry run)"}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
