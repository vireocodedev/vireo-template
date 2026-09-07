import assert from "node:assert/strict";
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { hostEnvironmentContractProblems } from "./flagship-demo-policy.mjs";
import {
  allowedLiteralMembers,
  readDeploymentArchive,
  validateDeploymentManifest,
} from "../deploy/hetzner/flagship-deployment-bundle.mjs";

const root = resolve(import.meta.dirname, "..");
const helper = join(root, "scripts/compose-database-contract.sh");
const deploy = join(root, "deploy/hetzner/deploy.sh");
const flagshipWorkflow = readFileSync(join(root, ".github/workflows/flagship-demo.yml"), "utf8");

function spawnReceiver(directory, payload, originalCommand, extraEnvironment = {}) {
  const inputPath = join(directory, "receiver-input.bin");
  writeFileSync(inputPath, payload, { mode: 0o600 });
  const input = openSync(inputPath, "r");
  try {
    return spawnSync(join(root, "deploy/hetzner/vireo-flagship-receiver.sh"), [], {
      cwd: root,
      encoding: "utf8",
      stdio: [input, "pipe", "pipe"],
      env: {
        ...process.env,
        ...extraEnvironment,
        VIREO_FLAGSHIP_ROOT: directory,
        SSH_ORIGINAL_COMMAND: originalCommand,
      },
    });
  } finally {
    closeSync(input);
  }
}

test("flagship policy binds guarded production reset and host-operated availability evidence", () => {
  const policy = JSON.parse(readFileSync(join(root, "contracts/flagship-demo-policy.json"), "utf8"));
  const docs = readFileSync(join(root, "docs/flagship-demo.md"), "utf8");
  assert.equal(policy.reset.command, "VIREO_FLAGSHIP_PRODUCTION_RESET=true VIREO_DEMO_RESET_CONFIRM=reset-vireo-demo ./scripts/reset-flagship-demo.sh");
  assert.match(docs, /operations\/deployment-state\.json/u);
  assert.match(docs, /journalctl -u vireo-flagship-demo-reset\.service/u);
  assert.match(docs, /journalctl -u vireo-flagship-demo-watchdog\.service/u);
  assert.doesNotMatch(docs, /Retained pre-reset, reset, and post-reset evidence/u);
});

test("flagship release upload requires exactly one absolute archive and manifest path", () => {
  for (const requiredFragment of [
    "mapfile -d '' archives < <(find release-input -name '*.tar.gz' -type f -print0)",
    "mapfile -d '' manifests < <(find release-input -name flagship-demo-manifest.json -type f -print0)",
    "if [[ ${#archives[@]} -ne 1 || ${#manifests[@]} -ne 1 ]]; then",
    "Expected exactly one release archive and one release manifest.",
    'archive="$(realpath "${archives[0]}")"',
    'manifest="$(realpath "${manifests[0]}")"',
    "transaction=\"$(node -p 'require(process.argv[1]).transaction' \"$manifest\")\"",
  ]) {
    assert.ok(
      flagshipWorkflow.includes(requiredFragment),
      `flagship release upload must retain ${requiredFragment}`,
    );
  }
});

function writeEnvironment(contents) {
  const directory = mkdtempSync(join(tmpdir(), "vireo-db-contract-"));
  const environmentFile = join(directory, ".env");
  writeFileSync(environmentFile, contents, { mode: 0o600 });
  chmodSync(environmentFile, 0o600);
  return environmentFile;
}

function resolveDatabaseContract(environmentFile) {
  return spawnSync(
    "bash",
    [
      "-c",
      'set -e; source "$1"; VIREO_DATABASE_ENV_FILE="$2"; resolve_compose_database_contract; printf "%s\\n%s\\n" "$VIREO_DATABASE_NAME" "$VIREO_DATABASE_OWNER_USER"',
      "bash",
      helper,
      environmentFile,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

function selectedEnvironmentFile(environmentFile) {
  return spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; VIREO_DATABASE_ENV_FILE="$2"; select_compose_database_environment; printf "%s\\n" "$VIREO_DATABASE_ENV_FILE_RESOLVED"',
      "bash",
      helper,
      environmentFile,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

function resolveDefaultDatabaseContract() {
  const emptyDirectory = mkdtempSync(join(tmpdir(), "vireo-db-contract-empty-"));
  return spawnSync(
    "bash",
    [
      "-c",
      'set -e; source "$1"; cd "$2"; resolve_compose_database_contract; printf "%s\\n%s\\n" "$VIREO_DATABASE_NAME" "$VIREO_DATABASE_OWNER_USER"',
      "bash",
      helper,
      emptyDirectory,
    ],
    { cwd: root, encoding: "utf8" },
  );
}

const splitEnvironment = [
  "POSTGRES_DB=vireo_demo",
  "POSTGRES_OWNER_USER=vireo_owner",
  "POSTGRES_OWNER_PASSWORD=owner-secret-A",
  "POSTGRES_RUNTIME_USER=vireo_runtime",
  "POSTGRES_RUNTIME_PASSWORD=runtime-secret-B",
].join("\n");

test("backup and restore resolve the current split database contract from an explicit env file", () => {
  const result = resolveDatabaseContract(writeEnvironment(splitEnvironment));

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "vireo_demo\nvireo_owner\n");
});

test("backup and restore forward the selected explicit env file to Compose", () => {
  const environmentFile = writeEnvironment(splitEnvironment);
  const result = selectedEnvironmentFile(environmentFile);
  const backup = readFileSync(join(root, "scripts/db-backup.sh"), "utf8");
  const restore = readFileSync(join(root, "scripts/db-restore.sh"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${environmentFile}\n`);
  for (const script of [backup, restore]) {
    assert.ok(
      script.indexOf('compose_command+=(--env-file "$VIREO_DATABASE_ENV_FILE_RESOLVED")') <
        script.indexOf("compose_command+=(--project-name"),
    );
  }
});

test("a selected database env file must define the split owner identity", () => {
  const result = resolveDatabaseContract(
    writeEnvironment("POSTGRES_DB=vireo_demo\nPOSTGRES_PASSWORD=opaque-secret"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Selected database environment file must define POSTGRES_DB and POSTGRES_OWNER_USER/u,
  );
  assert.doesNotMatch(result.stderr, /opaque-secret/u);
});

test("without an env file, database helpers retain canonical defaults", () => {
  const result = resolveDefaultDatabaseContract();

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "starter_template\nstarter_template_owner\n");
});

test("database environment parsing rejects duplicate assignments without exposing values", () => {
  const result = resolveDatabaseContract(
    writeEnvironment(
      ["POSTGRES_DB=first", "POSTGRES_DB=second", "TOKEN=never-print-me"].join(
        "\n",
      ),
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Duplicate environment key POSTGRES_DB/u);
  assert.doesNotMatch(result.stderr, /never-print-me/u);
});

function deployEnvironment(overrides) {
  return Object.entries({
    POSTGRES_DB: "vireo_demo",
    POSTGRES_OWNER_USER: "vireo_owner",
    POSTGRES_OWNER_PASSWORD: "owner-secret-A",
    POSTGRES_RUNTIME_USER: "vireo_runtime",
    POSTGRES_RUNTIME_PASSWORD: "runtime-secret-B",
    SESSION_COOKIE_SECURE: "true",
    FRONTEND_PORT: "3000",
    ...overrides,
  })
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function runDeploy(environmentFile, inheritedEnvironment = {}) {
  return spawnSync("bash", [deploy], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      VIREO_DEMO_COMPOSE_PROJECT: "vireo-contract-test",
      VIREO_DEMO_ENV_FILE: environmentFile,
      ...inheritedEnvironment,
    },
  });
}

test("deployment rejects equal owner and runtime usernames before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(
      deployEnvironment({ POSTGRES_RUNTIME_USER: "VIREO_OWNER" }),
    ),
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /POSTGRES_OWNER_USER and POSTGRES_RUNTIME_USER must differ/u);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment rejects equal database secrets before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(
      deployEnvironment({ POSTGRES_RUNTIME_PASSWORD: "owner-secret-A" }),
    ),
  );

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /POSTGRES_OWNER_PASSWORD and POSTGRES_RUNTIME_PASSWORD must differ/u,
  );
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment rejects an unchanged placeholder secret before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(
      deployEnvironment({
        POSTGRES_OWNER_PASSWORD: "replace-with-a-long-random-owner-secret",
      }),
    ),
  );

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /POSTGRES_OWNER_PASSWORD must be set to a non-placeholder value/u,
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /replace-with-a-long-random-owner-secret/u,
  );
});

test("deployment rejects inherited database overrides before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(deployEnvironment({})),
    { POSTGRES_RUNTIME_PASSWORD: "owner-secret-A" },
  );

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /Unset inherited POSTGRES_RUNTIME_PASSWORD so the deployment environment file remains authoritative/u,
  );
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment rejects quoted values before Compose can reinterpret them", () => {
  const result = runDeploy(
    writeEnvironment(
      deployEnvironment({ POSTGRES_RUNTIME_PASSWORD: '"owner-secret-A"' }),
    ),
  );

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /POSTGRES_RUNTIME_PASSWORD must use an unquoted, uninterpolated literal value/u,
  );
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment rejects an inherited session-cookie override before Compose starts", () => {
  const result = runDeploy(writeEnvironment(deployEnvironment({})), {
    SESSION_COOKIE_SECURE: "false",
  });

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /Unset inherited SESSION_COOKIE_SECURE so the deployment environment file remains authoritative/u,
  );
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment requires a secure session cookie before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(deployEnvironment({ SESSION_COOKIE_SECURE: "false" })),
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /SESSION_COOKIE_SECURE must be true for deployment/u);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /owner-secret-A/u);
});

test("deployment rejects legacy single-identity keys before Compose starts", () => {
  const result = runDeploy(
    writeEnvironment(deployEnvironment({ POSTGRES_USER: "legacy_owner" })),
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Legacy POSTGRES_USER\/POSTGRES_PASSWORD is not supported/u);
});

test("policy rejects a legacy identity and equal split credentials in template fixtures", () => {
  const problems = hostEnvironmentContractProblems(
    [
      "POSTGRES_OWNER_USER=VIREO_OWNER",
      "POSTGRES_OWNER_PASSWORD=shared-secret",
      "POSTGRES_RUNTIME_USER=vireo_owner",
      "POSTGRES_RUNTIME_PASSWORD=shared-secret",
      "SESSION_COOKIE_SECURE=true",
      "POSTGRES_USER=legacy_owner",
    ].join("\n"),
  );

  assert.deepEqual(problems, [
    "the host environment template must not use the legacy single database identity",
    "the host environment template must use distinct owner and runtime database users",
    "the host environment template must use distinct owner and runtime database secrets",
  ]);
  assert.doesNotMatch(problems.join("\n"), /shared-secret/u);
});

function deploymentManifest(members = []) {
  const required = [
    "Dockerfile", "compose.yaml", "compose.demo.yaml", "build/libs/app.jar",
    "frontend/Dockerfile", "frontend/nginx.conf", "frontend/dist/index.html",
    "deploy/postgres/init-runtime-role.sh", "deploy/backend-healthcheck.sh",
  ];
  return {
    schemaVersion: 1,
    repository: "vireocodedev/vireo-template",
    tag: "starter-template@1.2.3",
    commit: "a".repeat(40),
    release: "https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%401.2.3",
    runId: "123", runAttempt: "1", transaction: "b".repeat(64),
    dataClassification: "public-synthetic-only", archiveSha256: "c".repeat(64),
    members: [...required, ...members].map((path) => ({ path, size: 1, sha256: "d".repeat(64) })),
  };
}

test("deployment bundle policy rejects traversal, duplicate, link-shaped and unexpected members before host mutation", () => {
  const invalid = deploymentManifest([
    "../escape", "frontend/dist/index.html", "deploy/hetzner/secret.env",
  ]);
  const problems = validateDeploymentManifest(invalid);
  assert.ok(problems.some((problem) => problem.includes("not allowlisted: ../escape")));
  assert.ok(problems.some((problem) => problem.includes("duplicated: frontend/dist/index.html")));
  assert.ok(problems.some((problem) => problem.includes("secret.env")));
  assert.ok(!allowedLiteralMembers.has("deploy/hetzner/secret.env"));
});

function tarHeader(path, size, type = "0") {
  const header = Buffer.alloc(512);
  header.write(path);
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  header.fill(0x20, 148, 156);
  header.write(type, 156);
  header.write("ustar\0", 257);
  header.write("00", 263);
  const checksum = [...header].reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148);
  return header;
}

function archiveWith(entries) {
  const blocks = [];
  for (const { path, data = "x", type } of entries) {
    const content = Buffer.from(data);
    blocks.push(tarHeader(path, content.length, type));
    blocks.push(content, Buffer.alloc((512 - (content.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

test("archive parser rejects links, traversal, duplicate paths and truncated payloads without extracting", () => {
  assert.throws(() => readDeploymentArchive(archiveWith([{ path: "frontend/dist/link", type: "2" }])), /non-regular/u);
  assert.throws(() => readDeploymentArchive(Buffer.from("not-gzip")), /incorrect header check/u);
  const duplicate = readDeploymentArchive(archiveWith([
    { path: "frontend/dist/index.html" }, { path: "frontend/dist/index.html" },
  ]));
  assert.equal(duplicate.length, 2);
  const manifest = deploymentManifest();
  manifest.members = duplicate;
  assert.ok(validateDeploymentManifest(manifest).some((problem) => problem.includes("duplicated")));
});

test("archive parser accepts GNU tar's normalized frontend/dist directory layout", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-gnu-tar-"));
  mkdirSync(join(directory, "frontend", "dist", "assets"), { recursive: true });
  mkdirSync(join(directory, "frontend", "dist", "icons"), { recursive: true });
  writeFileSync(join(directory, "frontend", "dist", "index.html"), "ok");
  writeFileSync(join(directory, "frontend", "dist", "assets", "app.js"), "ok");
  writeFileSync(join(directory, "frontend", "dist", "icons", "vireo.svg"), "ok");
  const archive = join(directory, "bundle.tar.gz");
  const tar = spawnSync("tar", ["-czf", archive, "frontend"], { cwd: directory, encoding: "utf8" });
  assert.equal(tar.status, 0, tar.stderr);
  const members = readDeploymentArchive(archive);
  assert.deepEqual(members.map((member) => member.path), ["frontend/dist/icons/vireo.svg", "frontend/dist/index.html", "frontend/dist/assets/app.js"]);
});

test("bundle identity rejects malformed release authorization and hash/size drift", () => {
  const manifest = deploymentManifest();
  manifest.repository = "vireo template";
  manifest.dataClassification = "private";
  manifest.members[0].size = -1;
  const problems = validateDeploymentManifest(manifest, { expected: { commit: "b".repeat(40) } });
  assert.ok(problems.some((problem) => problem.includes("repository is malformed")));
  assert.ok(problems.some((problem) => problem.includes("public-synthetic-only")));
  assert.ok(problems.some((problem) => problem.includes("does not match the authorized release")));
  assert.ok(problems.some((problem) => problem.includes("member is malformed")));
});

test("host rollback uses fake boundaries, restores the complete prior snapshot, then removes only its staged slot", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-host-"));
  const operations = join(directory, "operations");
  const log = join(directory, "calls.log");
  writeFileSync(join(directory, ".env"), splitEnvironment, { mode: 0o600 });
  chmodSync(join(directory, ".env"), 0o600);
  const prior = {
    transaction: "a".repeat(64),
    revision: { tag: "starter-template@1.0.0" },
    endpoint: { kind: "legacy", target: "legacy", project: "vireo-flagship-demo", port: 3000, root: null },
  };
  const state = { schemaVersion: 2, generation: 4, accepted: prior, pending: {
    phase: "cutover", transaction: "b".repeat(64), target: "blue", prior,
  } };
  const actualOperations = join(directory, "operations");
  writeFileSync(join(directory, "fake-ingress"), `#!/usr/bin/env bash\necho ingress:$1 >> ${log}\n`);
  writeFileSync(join(directory, "fake-docker"), `#!/usr/bin/env bash\necho docker:$* >> ${log}\n`);
  chmodSync(join(directory, "fake-ingress"), 0o755);
  chmodSync(join(directory, "fake-docker"), 0o755);
  mkdirSync(actualOperations, { recursive: true });
  mkdirSync(join(directory, "slots", "blue"), { recursive: true });
  writeFileSync(join(actualOperations, "deployment-state.json"), JSON.stringify(state));
  const result = spawnSync("bash", [join(root, "deploy/hetzner/flagship-host-deploy.sh"), "rollback", "b".repeat(64), "4"], {
    cwd: root, encoding: "utf8", env: { ...process.env, VIREO_FLAGSHIP_ROOT: directory, VIREO_FLAGSHIP_LIBEXEC: join(root, "deploy/hetzner"), VIREO_INGRESS: join(directory, "fake-ingress"), VIREO_DOCKER: join(directory, "fake-docker"), VIREO_SUDO: "env" },
  });
  assert.equal(result.status, 0, result.stderr);
  const after = JSON.parse(readFileSync(join(actualOperations, "deployment-state.json"), "utf8"));
  assert.equal(after.pending, null);
  assert.deepEqual(after.accepted, prior);
  assert.match(readFileSync(log, "utf8"), /ingress:legacy/u);
});

test("forced receiver writes only a transaction-scoped bounded upload path", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-receiver-"));
  const payload = Buffer.from("bundle-bytes");
  const digest = createHash("sha256").update(payload).digest("hex");
  const transaction = "a".repeat(64);
  const result = spawnReceiver(directory, payload, `upload 123 1 ${transaction} ${payload.length} ${digest}`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"uploaded"/u);
  assert.equal(readFileSync(join(directory, "incoming", "123-1", transaction, "bundle.tar.gz"), "utf8"), "bundle-bytes");
});

test("forced receiver rejects bytes after a declared bounded upload", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-receiver-trailing-"));
  const payload = Buffer.from("bundle-bytes");
  const digest = createHash("sha256").update(payload).digest("hex");
  const transaction = "b".repeat(64);
  const result = spawnReceiver(
    directory,
    Buffer.concat([payload, Buffer.from("trailing")]),
    `upload 123 1 ${transaction} ${payload.length} ${digest}`,
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /uploaded/u);
});

function makeHostBundle(directory, tag, runId, runAttempt) {
  const source = join(directory, `source-${tag.replace(/[^a-z0-9]/giu, "-")}-${runId}-${runAttempt}`);
  const archive = join(source, "bundle.tar.gz");
  const manifest = join(source, "manifest.json");
  const files = {
    Dockerfile: "FROM scratch\n", "compose.yaml": "services: {}\n", "compose.demo.yaml": "services: {}\n",
    "build/libs/app.jar": "synthetic jar\n", "deploy/backend-healthcheck.sh": "#!/usr/bin/env bash\nexit 0\n",
    "deploy/postgres/init-runtime-role.sh": "#!/usr/bin/env bash\nexit 0\n", "frontend/Dockerfile": "FROM scratch\n",
    "frontend/nginx.conf": "events {}\n", "frontend/dist/index.html": "<!doctype html><title>Vireo</title>\n",
  };
  for (const [path, contents] of Object.entries(files)) {
    const target = join(source, path);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, contents);
  }
  const tar = spawnSync("tar", ["-czf", archive, ...Object.keys(files)], { cwd: source, encoding: "utf8" });
  assert.equal(tar.status, 0, tar.stderr);
  const release = `https://github.com/vireocodedev/vireo-template/releases/tag/${encodeURIComponent(tag)}`;
  const command = spawnSync("node", [join(root, "deploy/hetzner/flagship-deployment-bundle.mjs"), "manifest", archive, manifest, "vireocodedev/vireo-template", tag, "a".repeat(40), release, runId, runAttempt], { cwd: root, encoding: "utf8" });
  assert.equal(command.status, 0, command.stderr);
  const parsed = JSON.parse(readFileSync(manifest, "utf8"));
  const transfer = `${runId}-${runAttempt}`;
  const target = join(directory, "incoming", transfer, parsed.transaction);
  mkdirSync(target, { recursive: true });
  copyFileSync(archive, join(target, "bundle.tar.gz"));
  copyFileSync(manifest, join(target, "manifest.json"));
  return { ...parsed, transfer, archive, manifest };
}

function copyHostTransfer(directory, release, transfer) {
  const target = join(directory, "incoming", transfer, release.transaction);
  mkdirSync(target, { recursive: true });
  copyFileSync(release.archive, join(target, "bundle.tar.gz"));
  copyFileSync(release.manifest, join(target, "manifest.json"));
  return { ...release, transfer };
}

test("forced receiver rejects a manifest stream with trailing bytes despite the declared digest", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-receiver-manifest-trailing-"));
  const release = makeHostBundle(directory, "starter-template@1.0.0", "127", "1");
  const payload = readFileSync(release.manifest);
  const digest = createHash("sha256").update(payload).digest("hex");
  const result = spawnReceiver(
    directory,
    Buffer.concat([payload, Buffer.from("x")]),
    `manifest 127 1 ${release.transaction} ${digest}`,
    { VIREO_FLAGSHIP_LIBEXEC: join(root, "deploy/hetzner") },
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /"manifest"/u);
});

function fakeHost() {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-state-machine-"));
  const bin = join(directory, "bin");
  const log = join(directory, "calls.log");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(directory, ".env"), splitEnvironment, { mode: 0o600 });
  chmodSync(join(directory, ".env"), 0o600);
  writeFileSync(join(bin, "docker"), ["#!/usr/bin/env bash", `echo \"docker:$*\" >> \"${log}\"`, "[[ \"${VIREO_TEST_FAIL_DOCKER:-}\" != 1 ]]", ""].join("\n"));
  writeFileSync(join(bin, "curl"), ["#!/usr/bin/env bash", "headers=''; url=''", "while (($#)); do", "  if [[ \"$1\" == -D ]]; then headers=\"$2\"; shift 2; continue; fi", "  url=\"$1\"; shift", "done", "[[ \"$url\" == *127.0.0.1* && \"${VIREO_TEST_FAIL_LOOPBACK:-}\" == 1 ]] && exit 1", "[[ \"$url\" != *127.0.0.1* && \"${VIREO_TEST_FAIL_PUBLIC:-}\" == 1 ]] && exit 1", "[[ -z \"$headers\" ]] || printf 'content-security-policy: default-src \\\"self\\\"\\nx-frame-options: DENY\\n' > \"$headers\"", "if [[ \"$url\" == *readiness* ]]; then printf '{\"status\":\"UP\"}'; elif [[ \"$url\" == *vireo-deployment.json* ]]; then printf '{\"commit\":\"%s\",\"dataClassification\":\"public-synthetic-only\"}' \"${VIREO_TEST_COMMIT}\"; else printf ok; fi", ""].join("\n"));
  const ingress = join(bin, "ingress");
  writeFileSync(ingress, ["#!/usr/bin/env bash", `echo \"ingress:$1\" >> \"${log}\"`, ""].join("\n"));
  for (const file of [join(bin, "docker"), join(bin, "curl"), ingress]) chmodSync(file, 0o755);
  return { directory, log, env: { ...process.env, VIREO_FLAGSHIP_ROOT: directory, VIREO_FLAGSHIP_LIBEXEC: join(root, "deploy/hetzner"), VIREO_INGRESS: ingress, VIREO_SUDO: "env", VIREO_DOCKER: join(bin, "docker"), VIREO_CURL: join(bin, "curl"), VIREO_TEST_COMMIT: "a".repeat(40), VIREO_DEMO_PUBLIC_URL: "https://demo.test" } };
}

function hostController(host, args, overrides = {}) {
  return spawnSync("bash", [join(root, "deploy/hetzner/flagship-host-deploy.sh"), ...args], { cwd: root, encoding: "utf8", env: { ...host.env, ...overrides } });
}

function readHostState(host) {
  return JSON.parse(readFileSync(join(host.directory, "operations", "deployment-state.json"), "utf8"));
}

test("host reset safely waits for the first accepted immutable release", () => {
  const host = fakeHost();
  const result = hostController(host, ["reset"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "skipped",
    reason: "awaiting-first-immutable-release",
    target: "legacy",
    generation: 0,
  });
  assert.equal(existsSync(host.log), false);
  assert.equal(existsSync(join(host.directory, "operations", "deployment-state.json")), false);
});

test("host reset fails closed when accepted release evidence is incomplete", () => {
  const host = fakeHost();
  const operations = join(host.directory, "operations");
  mkdirSync(operations, { recursive: true });
  writeFileSync(join(operations, "deployment-state.json"), JSON.stringify({
    schemaVersion: 2,
    generation: 1,
    accepted: {
      transaction: "a".repeat(64),
      endpoint: { kind: "legacy", target: "legacy", project: "vireo-flagship-demo", port: 3000, root: null },
    },
    pending: null,
  }));
  const result = hostController(host, ["reset"]);
  assert.equal(result.status, 65);
  assert.match(result.stderr, /No accepted immutable bundle exists for reset/u);
});

test("host controller prepares, cuts over, accepts, resumes, serializes, rolls back and resets through fake boundaries", { timeout: 30_000 }, () => {
  const host = fakeHost();
  const first = makeHostBundle(host.directory, "starter-template@1.0.0", "123", "1");
  let result = hostController(host, ["prepare", first.transfer, first.transaction, "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "prepared", result.stderr);
  let state = readHostState(host);
  assert.equal(state.pending.target, "blue");
  assert.equal(state.pending.prior.endpoint.kind, "legacy");
  result = hostController(host, ["prepare", first.transfer, first.transaction, "2"]);
  assert.equal(JSON.parse(result.stdout).status, "prepared", result.stderr);
  result = hostController(host, ["activate", first.transaction, "2"]);
  assert.equal(JSON.parse(result.stdout).status, "cutover", result.stderr);
  result = hostController(host, ["activate", first.transaction, "3"]);
  assert.equal(JSON.parse(result.stdout).status, "cutover", result.stderr);
  result = hostController(host, ["accept", first.transaction, "3"]);
  assert.equal(JSON.parse(result.stdout).status, "accepted", result.stderr);
  state = readHostState(host);
  assert.equal(state.accepted.endpoint.target, "blue");
  assert.equal(state.accepted.endpoint.root, join(host.directory, "slots", "blue"));
  result = hostController(host, ["accept", first.transaction, "0"]);
  assert.equal(JSON.parse(result.stdout).status, "accepted", result.stderr);

  const duplicate = copyHostTransfer(host.directory, first, "123-2");
  result = hostController(host, ["prepare", duplicate.transfer, duplicate.transaction, "4"]);
  assert.equal(JSON.parse(result.stdout).status, "accepted", result.stderr);
  assert.equal(existsSync(join(host.directory, "incoming", duplicate.transfer, duplicate.transaction)), false);
  const second = makeHostBundle(host.directory, "starter-template@1.0.1", "124", "1");
  result = hostController(host, ["prepare", second.transfer, second.transaction, "4"]);
  assert.equal(JSON.parse(result.stdout).status, "prepared", result.stderr);
  result = hostController(host, ["prepare", second.transfer, second.transaction, "6"]);
  assert.equal(JSON.parse(result.stdout).status, "prepared", result.stderr);
  result = hostController(host, ["activate", second.transaction, "6"]);
  assert.equal(JSON.parse(result.stdout).status, "cutover", result.stderr);
  result = hostController(host, ["activate", second.transaction, "7"]);
  assert.equal(JSON.parse(result.stdout).status, "cutover", result.stderr);
  const third = makeHostBundle(host.directory, "starter-template@1.0.2", "125", "1");
  result = hostController(host, ["prepare", third.transfer, third.transaction, "7"]);
  assert.equal(JSON.parse(result.stdout).status, "busy", result.stderr);
  result = hostController(host, ["rollback", second.transaction, "7"]);
  assert.equal(JSON.parse(result.stdout).status, "rolled-back", result.stderr);
  state = readHostState(host);
  assert.equal(state.accepted.transaction, first.transaction);

  const expired = { ...state, pending: { phase: "cutover", transaction: second.transaction, target: "green", prior: state.accepted, expiresAt: new Date(0).toISOString() } };
  writeFileSync(join(host.directory, "operations", "deployment-state.json"), JSON.stringify(expired));
  result = hostController(host, ["rollback", second.transaction, "7"]);
  assert.equal(result.status, 75, result.stderr);
  assert.equal(readHostState(host).pending.transaction, second.transaction);
  result = hostController(host, ["watchdog"]);
  assert.equal(result.status, 0, result.stderr);
  state = readHostState(host);
  assert.equal(state.pending, null);
  assert.equal(state.accepted.transaction, first.transaction);

  result = hostController(host, ["reset"]);
  assert.equal(JSON.parse(result.stdout).status, "accepted", result.stderr);
  state = readHostState(host);
  assert.equal(state.accepted.endpoint.target, "green");
  result = hostController(host, ["reset"], { VIREO_TEST_FAIL_PUBLIC: "1" });
  assert.notEqual(result.status, 0);
  state = readHostState(host);
  assert.equal(state.pending, null);
  assert.equal(state.accepted.endpoint.target, "green");
  assert.match(readFileSync(host.log, "utf8"), /docker:compose.*down/u);
});

test("durable staging state makes interrupted builds recoverable by exact retry and watchdog", () => {
  const host = fakeHost();
  const release = makeHostBundle(host.directory, "starter-template@1.0.0", "128", "1");
  const prior = { endpoint: { kind: "legacy", target: "legacy", project: "vireo-flagship-demo", port: 3000, root: null } };
  const operations = join(host.directory, "operations");
  mkdirSync(join(host.directory, "slots", "blue"), { recursive: true });
  mkdirSync(operations, { recursive: true });
  writeFileSync(join(operations, "deployment-state.json"), JSON.stringify({
    schemaVersion: 2, generation: 7, accepted: prior,
    pending: { phase: "staging", transaction: release.transaction, target: "blue", prior, archive: "interrupted", manifest: "interrupted", expiresAt: new Date(Date.now() + 60_000).toISOString() },
  }));
  let result = hostController(host, ["prepare", release.transfer, release.transaction, "7"]);
  assert.equal(JSON.parse(result.stdout).status, "retry", result.stderr);
  let state = readHostState(host);
  assert.equal(state.generation, 8);
  assert.equal(state.pending, null);
  assert.equal(existsSync(join(host.directory, "incoming", release.transfer, release.transaction, "bundle.tar.gz")), true);

  result = hostController(host, ["prepare", release.transfer, release.transaction, "8"]);
  assert.equal(JSON.parse(result.stdout).status, "prepared", result.stderr);
  state = readHostState(host);
  assert.equal(state.pending.phase, "prepared");
  state.pending.phase = "staging";
  state.pending.expiresAt = new Date(0).toISOString();
  writeFileSync(join(operations, "deployment-state.json"), JSON.stringify(state));
  result = hostController(host, ["watchdog"]);
  assert.equal(result.status, 0, result.stderr);
  state = readHostState(host);
  assert.equal(state.pending, null);
  assert.equal(state.accepted.endpoint.kind, "legacy");
  assert.match(readFileSync(host.log, "utf8"), /vireo-flagship-demo-blue down/u);
});

test("host pre-state health failure clears the isolated candidate before it records pending state", { timeout: 30_000 }, () => {
  const host = fakeHost();
  const release = makeHostBundle(host.directory, "starter-template@1.0.0", "126", "1");
  const result = hostController(host, ["prepare", release.transfer, release.transaction, "0"], { VIREO_TEST_FAIL_LOOPBACK: "1" });
  assert.notEqual(result.status, 0);
  const stateFile = join(host.directory, "operations", "deployment-state.json");
  assert.equal(existsSync(stateFile), true);
  assert.equal(JSON.parse(readFileSync(stateFile, "utf8")).pending, null);
  assert.equal(JSON.parse(readFileSync(stateFile, "utf8")).accepted.endpoint.kind, "legacy");
  assert.match(readFileSync(host.log, "utf8"), /vireo-flagship-demo-blue down/u);
});

test("host controller activates, resumes cutover, accepts, and watchdog-rolls back legacy state through fake boundaries", () => {
  const directory = mkdtempSync(join(tmpdir(), "vireo-flagship-phases-"));
  mkdirSync(join(directory, "operations"), { recursive: true });
  const prior = { endpoint: { kind: "legacy", target: "legacy", project: "vireo-flagship-demo", port: 3000, root: null } };
  const transaction = "c".repeat(64);
  const pending = { phase: "prepared", transaction, target: "blue", prior, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  writeFileSync(join(directory, "operations", "deployment-state.json"), JSON.stringify({ schemaVersion: 2, generation: 9, accepted: prior, pending }));
  const ingress = join(directory, "ingress");
  writeFileSync(ingress, "#!/usr/bin/env bash\nexit 0\n"); chmodSync(ingress, 0o755);
  const env = { ...process.env, VIREO_FLAGSHIP_ROOT: directory, VIREO_FLAGSHIP_LIBEXEC: join(root, "deploy/hetzner"), VIREO_INGRESS: ingress, VIREO_SUDO: "env" };
  const controller = join(root, "deploy/hetzner/flagship-host-deploy.sh");
  let result = spawnSync("bash", [controller, "activate", transaction, "9"], { cwd: root, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync("bash", [controller, "activate", transaction, "10"], { cwd: root, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync("bash", [controller, "accept", transaction, "10"], { cwd: root, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  let state = JSON.parse(readFileSync(join(directory, "operations", "deployment-state.json"), "utf8"));
  assert.equal(state.pending, null);
  assert.equal(state.accepted.endpoint.target, "blue");
  state = { schemaVersion: 2, generation: 11, accepted: prior, pending: { ...pending, phase: "cutover", expiresAt: new Date(0).toISOString() } };
  writeFileSync(join(directory, "operations", "deployment-state.json"), JSON.stringify(state));
  result = spawnSync("bash", [controller, "watchdog"], { cwd: root, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  state = JSON.parse(readFileSync(join(directory, "operations", "deployment-state.json"), "utf8"));
  assert.equal(state.pending, null);
  assert.equal(state.accepted.endpoint.target, "legacy");
});
