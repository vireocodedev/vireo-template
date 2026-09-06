import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { APP_IDENTITY, PWA_POLICY, createPwaManifest } from "../pwa-policy.mjs";

function problem(problems, message) {
  problems.push(message);
}

function readText(path, problems, label) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    problem(problems, `${label} is missing or unreadable: ${path}`);
    return null;
  }
}

function expectedPngDimensions(sizes) {
  const [width, height] = sizes.split("x").map(Number);
  return { width, height };
}

/** Reads only the PNG signature and IHDR header; no image library is required. */
function readPngDimensions(path, problems) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    problem(problems, `PWA icon is missing or unreadable: ${path}`);
    return null;
  }

  const signature = "89504e470d0a1a0a";
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString("hex") !== signature ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    problem(problems, `PWA icon is not a valid PNG with an IHDR header: ${path}`);
    return null;
  }

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function checkPng(path, sizes, problems) {
  const actual = readPngDimensions(path, problems);
  if (!actual) return;
  const expected = expectedPngDimensions(sizes);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    problem(problems, `PWA icon ${path} is ${actual.width}x${actual.height}; expected ${sizes}`);
  }
}

function checkManifest(manifest, problems) {
  const expected = createPwaManifest();
  for (const key of [
    "id",
    "name",
    "short_name",
    "description",
    "lang",
    "theme_color",
    "background_color",
    "display",
    "start_url",
    "scope",
  ]) {
    if (manifest[key] !== expected[key]) {
      problem(problems, `manifest.webmanifest ${key} must equal the shared PWA policy`);
    }
  }

  if (!Array.isArray(manifest.icons)) {
    problem(problems, "manifest.webmanifest must declare PNG icons");
    return;
  }

  for (const expectedIcon of PWA_POLICY.icons) {
    if (
      !manifest.icons.some(
        icon =>
          icon?.src === expectedIcon.src &&
          icon?.sizes === expectedIcon.sizes &&
          icon?.type === expectedIcon.type &&
          icon?.purpose === expectedIcon.purpose,
      )
    ) {
      problem(problems, `manifest.webmanifest is missing ${expectedIcon.purpose} icon ${expectedIcon.src}`);
    }
  }
}

function checkWorkboxRoutePolicy(problems) {
  const navigationPattern = new RegExp(PWA_POLICY.workbox.navigationDenylistPathPatternSource, "u");
  const runtimePattern = new RegExp(PWA_POLICY.workbox.runtimeUrlPatternSource, "u");
  const sameOriginApiUrl = "https://example.test/api/items";

  if (
    !navigationPattern.test("/api") ||
    !navigationPattern.test("/api/items") ||
    !navigationPattern.test("/api?probe=1")
  ) {
    problem(problems, "PWA navigation denylist must match API pathnames");
  }
  if (navigationPattern.test(sameOriginApiUrl)) {
    problem(problems, "PWA navigation denylist must remain anchored to pathnames, not absolute URLs");
  }
  if (
    PWA_POLICY.workbox.runtimeUrlPatternSource.startsWith("^") ||
    !runtimePattern.test(sameOriginApiUrl) ||
    !runtimePattern.test("https://example.test/api?probe=1")
  ) {
    problem(problems, "PWA runtime route must match absolute same-origin API URLs without a leading anchor");
  }
  if (runtimePattern.test("https://example.test/apiculture")) {
    problem(problems, "PWA runtime route must stop at the API path boundary");
  }
  if (PWA_POLICY.workbox.runtimeHandler !== "NetworkOnly") {
    problem(problems, "PWA API runtime handler must be NetworkOnly");
  }
}

/**
 * Validate source files only. `requireNginx` is intentionally optional so this
 * module can be copied into frontend-only generated projects.
 */
export function checkPwaSourceContract({ frontendRoot, requireNginx = false } = {}) {
  const problems = [];
  if (!frontendRoot) return ["A frontendRoot is required for the PWA source contract check"];
  if (APP_IDENTITY.shortName.length > 12) {
    problem(problems, "PWA shortName must be 12 characters or fewer for installed-app labels");
  }
  checkWorkboxRoutePolicy(problems);

  const vitePath = resolve(frontendRoot, "vite.config.ts");
  const vite = readText(vitePath, problems, "Vite configuration");
  if (vite) {
    for (const required of [
      "VitePWA(",
      "createPwaManifest",
      "transformAppIdentityHtml",
      "PWA_POLICY.workbox.navigationDenylistPathPatternSource",
      "PWA_POLICY.workbox.runtimeUrlPatternSource",
      "PWA_POLICY.workbox.runtimeHandler",
      "VIREO_BUILD_REVISION",
    ]) {
      if (!vite.includes(required)) problem(problems, `vite.config.ts must contain ${required}`);
    }
  }

  const index = readText(resolve(frontendRoot, "index.html"), problems, "HTML entry point");
  if (index) {
    for (const required of [
      "__VIREO_APP_NAME__",
      "__VIREO_APP_DESCRIPTION__",
      "__VIREO_APP_THEME_COLOR__",
      "__VIREO_APP_LANGUAGE__",
      "__VIREO_BUILD_REVISION__",
      PWA_POLICY.appleTouchIcon.src,
    ]) {
      if (!index.includes(required)) problem(problems, `index.html must contain ${required}`);
    }
  }

  for (const icon of [...PWA_POLICY.icons, PWA_POLICY.appleTouchIcon]) {
    checkPng(resolve(frontendRoot, "public", icon.src.slice(1)), icon.sizes, problems);
  }

  if (requireNginx) {
    const nginx = readText(resolve(frontendRoot, "nginx.conf"), problems, "Nginx configuration");
    if (nginx) {
      for (const required of [
        "location = /sw.js",
        "location = /manifest.webmanifest",
        "default_type application/manifest+json;",
        'Cache-Control "no-cache"',
        "/actuator/health/",
      ]) {
        if (!nginx.includes(required)) problem(problems, `nginx.conf must contain ${required}`);
      }
      problems.push(...checkOfflineSseNginxContract(nginx));
    }
  }
  return problems;
}

/** Keep the connectivity authority stream deployable through the owned Nginx path. */
export function checkOfflineSseNginxContract(nginx) {
  const problems = [];
  const streamLocation = "location = /api/offline/heartbeat/stream";
  const apiLocation = "location /api/";
  const streamIndex = nginx.indexOf(streamLocation);
  const apiIndex = nginx.indexOf(apiLocation);

  if (streamIndex < 0) {
    return ["nginx.conf must define an exact /api/offline/heartbeat/stream SSE location"];
  }
  if (apiIndex < 0 || streamIndex > apiIndex) {
    problems.push("nginx.conf must define the exact offline SSE location before the general /api/ location");
  }

  const locationBody =
    nginx.slice(streamIndex).match(/^location = \/api\/offline\/heartbeat\/stream\s*\{(?<body>[\s\S]*?)^\s*\}/mu)
      ?.groups?.body ?? "";
  for (const required of [
    "proxy_pass http://app:8080;",
    "proxy_http_version 1.1;",
    "proxy_buffering off;",
    "proxy_cache off;",
    'proxy_set_header Connection "";',
    "proxy_read_timeout 60s;",
    "proxy_set_header Host $host;",
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "proxy_set_header X-Forwarded-Host $host;",
    "proxy_set_header X-Forwarded-Proto $scheme;",
  ]) {
    if (!locationBody.includes(required)) {
      problems.push(`nginx.conf offline SSE location must contain ${required}`);
    }
  }
  return problems;
}

/** Validate emitted PWA metadata and assets after `vite build`. */
export function checkPwaBuiltContract({ frontendRoot, distRoot } = {}) {
  const problems = [];
  if (!frontendRoot || !distRoot) return ["frontendRoot and distRoot are required for the built PWA contract check"];

  const manifestPath = resolve(distRoot, PWA_POLICY.manifestPath.slice(1));
  const manifestText = readText(manifestPath, problems, "Built manifest");
  if (manifestText) {
    try {
      checkManifest(JSON.parse(manifestText), problems);
    } catch {
      problem(problems, "Built manifest is not valid JSON");
    }
  }

  const index = readText(resolve(distRoot, "index.html"), problems, "Built HTML entry point");
  if (index) {
    for (const expected of [
      APP_IDENTITY.name,
      APP_IDENTITY.description,
      APP_IDENTITY.themeColor,
      PWA_POLICY.manifestPath,
      PWA_POLICY.appleTouchIcon.src,
    ]) {
      if (!index.includes(expected)) problem(problems, `Built index.html must contain ${expected}`);
    }
    const buildRevision = index.match(/<meta\s+name=["']vireo-build-revision["']\s+content=["']([^"']+)["']/u)?.[1];
    if (!buildRevision || buildRevision === "__VIREO_BUILD_REVISION__") {
      problem(problems, "Built index.html must contain a resolved Vireo build revision marker");
    }
  }

  const serviceWorker = resolve(distRoot, PWA_POLICY.serviceWorkerPath.slice(1));
  if (!existsSync(serviceWorker) || !statSync(serviceWorker).isFile()) {
    problem(problems, `Built service worker is missing: ${serviceWorker}`);
  } else {
    const serviceWorkerSource = readText(serviceWorker, problems, "Built service worker");
    if (serviceWorkerSource?.includes("PWA_POLICY")) {
      problem(problems, "Built service worker contains an unresolved PWA_POLICY reference");
    }
    if (serviceWorkerSource) {
      const escapedRuntimeSource = PWA_POLICY.workbox.runtimeUrlPatternSource.replaceAll("/", "\\/");
      const expectedRuntimePattern = `/${escapedRuntimeSource}/u`;
      const invalidAnchoredPattern = `/^${escapedRuntimeSource}/u`;
      if (
        !serviceWorkerSource.includes(`registerRoute(${expectedRuntimePattern},new `) ||
        !serviceWorkerSource.includes(`.${PWA_POLICY.workbox.runtimeHandler}`)
      ) {
        problem(problems, "Built service worker is missing the serialized NetworkOnly API route");
      }
      if (serviceWorkerSource.includes(`registerRoute(${invalidAnchoredPattern},new `)) {
        problem(problems, "Built service worker anchors the API runtime route against an absolute URL");
      }
    }
  }

  for (const icon of [...PWA_POLICY.icons, PWA_POLICY.appleTouchIcon]) {
    checkPng(resolve(distRoot, icon.src.slice(1)), icon.sizes, problems);
  }
  return problems;
}

export function formatPwaContractProblems(problems) {
  return problems.map(entry => `- ${entry}`).join("\n");
}
