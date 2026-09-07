import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { createConnection } from "node:net";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATABASE_MODES,
  detectComposeCommand,
  externalDatasourceProblem,
  resolveDatabaseMode,
} from "./database-development.mjs";
import { evaluateVireoPackageCompatibility } from "./vireo-package-compatibility.mjs";
import { inspectVerificationHost } from "./verification-host.mjs";
import { checkPwaSourceContract } from "../frontend/scripts/pwa-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const jsonMode = process.argv.includes("--json");

const environmentFile = resolve(root, ".env");
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

function command(name, args = ["--version"]) {
  const completed = spawnSync(name, args, { encoding: "utf8" });
  if (completed.error || completed.status !== 0) return null;
  return `${completed.stdout ?? ""}\n${completed.stderr ?? ""}`.trim();
}

function major(version) {
  return Number(version?.match(/\d+/u)?.[0]);
}

function executableInPath(name) {
  const suffixes =
    process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  return (process.env.PATH ?? "")
    .split(process.platform === "win32" ? ";" : ":")
    .some((directory) =>
      suffixes.some((suffix) => {
        try {
          accessSync(resolve(directory, `${name}${suffix}`), constants.X_OK);
          return true;
        } catch {
          return false;
        }
      }),
    );
}

function javaVersion() {
  const executed = command("java", ["-version"]);
  if (executed) return executed;
  if (!process.env.JAVA_HOME) return null;
  try {
    return (
      readFileSync(resolve(process.env.JAVA_HOME, "release"), "utf8").match(
        /^JAVA_VERSION="([^"]+)"/mu,
      )?.[1] ?? null
    );
  } catch {
    return null;
  }
}

function checkPort(port) {
  return new Promise((resolveCheck) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.unref();
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolveCheck(false);
    });
    socket.once("error", () => resolveCheck(true));
    socket.once("timeout", () => {
      socket.destroy();
      resolveCheck(true);
    });
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function isCanonicalProjectPath(path) {
  if (typeof path !== "string" || path.length === 0 || path.includes("\\"))
    return false;
  if (isAbsolute(path) || path.startsWith("/")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

function isContainedPath(base, candidate) {
  const pathFromBase = relative(base, candidate);
  return (
    pathFromBase !== "" &&
    !isAbsolute(pathFromBase) &&
    pathFromBase !== ".." &&
    !pathFromBase.startsWith(`..${sep}`)
  );
}

function hasOnlyContainedNonSymlinkComponents(path) {
  if (!isCanonicalProjectPath(path)) return false;

  const realRoot = realpathSync(root);
  let current = root;
  for (const segment of path.split("/")) {
    current = resolve(current, segment);
    if (!isContainedPath(root, current)) return false;
    if (!existsSync(current)) continue;
    if (lstatSync(current).isSymbolicLink()) return false;
    const resolvedCurrent = realpathSync(current);
    if (
      resolvedCurrent !== realRoot &&
      !resolvedCurrent.startsWith(`${realRoot}${sep}`)
    )
      return false;
  }
  return true;
}

function readManagedProvenance() {
  const manifestPath = ".vireo/managed-files.json";
  if (!hasOnlyContainedNonSymlinkComponents(manifestPath))
    throw new Error("managed-file provenance path is unsafe");
  return readJson(manifestPath);
}

function validateManagedProvenance(managed, projectMetadata) {
  if (managed?.schemaVersion !== 1) return false;
  if (!/^[a-f0-9]{40}$/u.test(managed?.templateCommit ?? "")) return false;
  if (
    !/^[a-f0-9]{40}$/u.test(projectMetadata?.templateCommit ?? "") ||
    managed.templateCommit !== projectMetadata.templateCommit
  )
    return false;
  if (!Array.isArray(managed.files) || managed.files.length === 0) return false;

  const paths = new Set();
  for (const file of managed.files) {
    if (
      !isCanonicalProjectPath(file?.path) ||
      paths.has(file.path) ||
      !/^[a-f0-9]{64}$/u.test(file?.sha256 ?? "") ||
      !hasOnlyContainedNonSymlinkComponents(file.path) ||
      !existsSync(resolve(root, file.path))
    )
      return false;
    paths.add(file.path);
  }
  return true;
}

function result(code, status, summary, remedy) {
  return { code, status, summary, ...(remedy ? { remedy } : {}) };
}

export function resolveDoctorProfile(metadata) {
  return typeof metadata?.profile === "string" && metadata.profile.trim() !== ""
    ? metadata.profile
    : "unknown";
}

export async function runDoctor() {
  const results = [];
  const node = process.versions.node;
  results.push(
    major(node) === 24
      ? result("VIR-ENV-001", "pass", `Node ${node}`)
      : result(
          "VIR-ENV-001",
          "fail",
          `Node ${node}; Vireo requires Node 24`,
          "Install Node 24.15 or newer, but below 25.",
        ),
  );

  const npm =
    process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/u)?.[1] ??
    command("corepack", ["npm", "--version"]);
  results.push(
    npm === "12.0.2"
      ? result("VIR-ENV-002", "pass", `npm ${npm}`)
      : result(
          "VIR-ENV-002",
          "fail",
          `Expected Corepack npm 12.0.2; found ${npm ?? "nothing"}`,
          "Run `corepack enable` and `corepack prepare npm@12.0.2 --activate`.",
        ),
  );

  const java = javaVersion();
  results.push(
    major(java) === 21 || major(java) === 25
      ? result("VIR-ENV-003", "pass", java.split("\n")[0])
      : result(
          "VIR-ENV-003",
          "fail",
          `Java 21 or 25 is required; found ${java ?? "nothing"}`,
          "Install a JDK 21 distribution and set JAVA_HOME.",
        ),
  );

  results.push(
    executableInPath("git")
      ? result("VIR-ENV-004", "pass", "Git is available")
      : result(
          "VIR-ENV-004",
          "warn",
          "Git is unavailable",
          "Install Git if you want local version control.",
        ),
  );

  const verificationHost = inspectVerificationHost();
  results.push(
    result(
      "VIR-VERIFY-001",
      verificationHost.status,
      verificationHost.summary,
      verificationHost.remedy,
    ),
  );

  const metadataPath = existsSync(resolve(root, ".vireo/project.json"))
    ? ".vireo/project.json"
    : ".vireo/template.json";
  let metadata;
  try {
    metadata = readJson(metadataPath);
    results.push(result("VIR-PROJECT-001", "pass", `Valid ${metadataPath}`));
  } catch {
    results.push(
      result(
        "VIR-PROJECT-001",
        "fail",
        "Vireo project metadata is missing or invalid",
        "Restore `.vireo/project.json`, or rerun the create command into a new directory.",
      ),
    );
    metadata = { database: "h2" };
  }

  try {
    const managed = readManagedProvenance();
    const valid = validateManagedProvenance(
      managed,
      metadataPath === ".vireo/project.json" &&
        hasOnlyContainedNonSymlinkComponents(metadataPath)
        ? metadata
        : undefined,
    );
    results.push(
      valid
        ? result("VIR-PROJECT-002", "pass", "Managed-file provenance is ready")
        : result(
            "VIR-PROJECT-002",
            "fail",
            "Managed-file provenance is invalid",
            "Run the declared Vireo upgrade dry run and restore .vireo/managed-files.json before applying it.",
          ),
    );
  } catch {
    results.push(
      result(
        "VIR-PROJECT-002",
        "warn",
        "Managed-file provenance is unavailable",
        "Projects created before 0.7 receive provenance during the reviewed 0.6-to-0.7 upgrade.",
      ),
    );
  }

  const frontendInstalled = existsSync(resolve(root, "frontend/node_modules"));
  results.push(
    frontendInstalled
      ? result("VIR-DEPS-001", "pass", "Frontend dependencies are installed")
      : result(
          "VIR-DEPS-001",
          "fail",
          "Frontend dependencies are not installed",
          "Run `corepack npm run setup`.",
        ),
  );

  try {
    const frontend = readJson("frontend/package.json");
    const contract = readJson("contracts/vireo-package-compatibility.json");
    const compatibility = evaluateVireoPackageCompatibility(
      frontend.dependencies,
      contract,
    );
    results.push(
      compatibility.compatible
        ? result(
            "VIR-DEPS-002",
            "pass",
            `Vireo frontend packages match ${contract.id}`,
          )
        : result(
            "VIR-DEPS-002",
            "fail",
            compatibility.problems.join(" "),
            "Use package declarations admitted by contracts/vireo-package-compatibility.json.",
          ),
    );
  } catch {
    results.push(
      result(
        "VIR-DEPS-002",
        "fail",
        "Cannot read the frontend manifest or Vireo compatibility contract",
        "Restore frontend/package.json and contracts/vireo-package-compatibility.json.",
      ),
    );
  }

  const backendPort = await checkPort(8080);
  const frontendPort = await checkPort(3000);
  results.push(
    backendPort
      ? result("VIR-PORT-001", "pass", "Backend port 8080 is available")
      : result(
          "VIR-PORT-001",
          "fail",
          "Backend port 8080 is already in use",
          "Stop the process using port 8080, then retry.",
        ),
  );
  results.push(
    frontendPort
      ? result("VIR-PORT-002", "pass", "Frontend port 3000 is available")
      : result(
          "VIR-PORT-002",
          "fail",
          "Frontend port 3000 is already in use",
          "Stop the process using port 3000, then retry.",
        ),
  );

  let databaseMode;
  try {
    databaseMode = resolveDatabaseMode(metadata);
  } catch (error) {
    results.push(
      result(
        "VIR-DB-001",
        "fail",
        error.message,
        "Set VIREO_DATABASE_MODE to h2, compose, or external.",
      ),
    );
  }

  if (databaseMode === DATABASE_MODES.COMPOSE) {
    const compose = detectComposeCommand();
    results.push(
      compose
        ? result("VIR-DB-001", "pass", `Managed Compose: ${compose.summary}`)
        : result(
            "VIR-DB-001",
            "fail",
            "Managed Compose mode cannot find a Compose launcher",
            "Start Docker and install either the `docker compose` plugin or standalone `docker-compose`.",
          ),
    );
  } else if (databaseMode === DATABASE_MODES.EXTERNAL) {
    const datasourceProblem = externalDatasourceProblem();
    results.push(
      datasourceProblem
        ? result(
            "VIR-DB-001",
            "fail",
            datasourceProblem,
            "Export the complete SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, and SPRING_DATASOURCE_PASSWORD configuration.",
          )
        : result(
            "VIR-DB-001",
            "pass",
            "External datasource configuration is present",
          ),
    );
  } else if (databaseMode === DATABASE_MODES.H2) {
    results.push(result("VIR-DB-001", "pass", "H2 development mode selected"));
  }

  const pwaProblems = checkPwaSourceContract({
    frontendRoot: resolve(root, "frontend"),
    requireNginx: metadata.profile !== "frontend",
  });
  results.push(
    pwaProblems.length === 0
      ? result(
          "VIR-PWA-001",
          "pass",
          "PWA source policy, icons, and deployment configuration are valid",
        )
      : result(
          "VIR-PWA-001",
          "fail",
          pwaProblems[0],
          "Run `corepack npm run pwa:check:source` from frontend and restore the shared PWA policy.",
        ),
  );

  return {
    schemaVersion: 1,
    ok: results.every((entry) => entry.status !== "fail"),
    project: metadata.projectName ?? "unknown",
    profile: resolveDoctorProfile(metadata),
    database: metadata.database,
    databaseMode: databaseMode ?? "invalid",
    results,
  };
}

async function main() {
  const report = await runDoctor();
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Vireo doctor — ${report.project} (${report.databaseMode})`);
    for (const entry of report.results) {
      console.log(
        `${entry.status === "pass" ? "✓" : entry.status === "warn" ? "!" : "✗"} ${entry.code} ${entry.summary}`,
      );
      if (entry.remedy) console.log(`  Remedy: ${entry.remedy}`);
    }
    console.log(
      report.ok
        ? report.results.some((entry) => entry.status === "warn")
          ? "Ready for development with warnings; supported release evidence still requires the host noted above."
          : "Ready to run."
        : "Resolve the failed checks above and rerun `corepack npm run doctor`.",
    );
  }
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
