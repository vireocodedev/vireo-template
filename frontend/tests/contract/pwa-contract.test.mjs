import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkOfflineSseNginxContract,
  checkPwaBuiltContract,
  checkPwaSourceContract,
} from "../../scripts/pwa-contract.mjs";

const temporaryRoots = [];

async function temporaryFrontend() {
  const root = await mkdtemp(resolve(tmpdir(), "vireo-pwa-contract-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })));
});

describe("PWA contract checker", () => {
  it("reports missing source configuration and icon assets", async () => {
    const frontendRoot = await temporaryFrontend();

    const problems = checkPwaSourceContract({ frontendRoot });

    expect(problems.some(entry => entry.includes("Vite configuration is missing or unreadable"))).toBe(true);
    expect(problems.some(entry => entry.includes("PWA icon is missing or unreadable"))).toBe(true);
  });

  it("reports a malformed Vite policy instead of accepting file presence", async () => {
    const frontendRoot = await temporaryFrontend();
    await writeFile(resolve(frontendRoot, "vite.config.ts"), "export default {};\n");
    await writeFile(resolve(frontendRoot, "index.html"), "<!doctype html>\n");

    const problems = checkPwaSourceContract({ frontendRoot });

    expect(problems).toContain("vite.config.ts must contain VitePWA(");
    expect(problems).toContain("index.html must contain __VIREO_APP_NAME__");
  });

  it("requires the deployment server to emit the manifest MIME type", async () => {
    const frontendRoot = await temporaryFrontend();
    await writeFile(
      resolve(frontendRoot, "nginx.conf"),
      `location = /sw.js {}
location = /manifest.webmanifest {
  add_header Cache-Control "no-cache";
}
location ~ ^/actuator/health/ {}
`,
    );

    const problems = checkPwaSourceContract({ frontendRoot, requireNginx: true });

    expect(problems).toContain("nginx.conf must contain default_type application/manifest+json;");
  });

  it("requires an unbuffered, uncached, long-lived proxy for the offline SSE stream", () => {
    const missingContract = checkOfflineSseNginxContract("location /api/ {}");
    expect(missingContract).toContain("nginx.conf must define an exact /api/offline/heartbeat/stream SSE location");

    const validContract = checkOfflineSseNginxContract(`
location = /api/offline/heartbeat/stream {
  proxy_pass http://app:8080;
  proxy_http_version 1.1;
  proxy_buffering off;
  proxy_cache off;
  proxy_set_header Connection "";
  proxy_read_timeout 60s;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location /api/ {}
`);
    expect(validContract).toEqual([]);
  });

  it("reports malformed emitted metadata and a missing worker", async () => {
    const frontendRoot = await temporaryFrontend();
    const distRoot = resolve(frontendRoot, "dist");
    await mkdir(distRoot, { recursive: true });
    await writeFile(resolve(distRoot, "manifest.webmanifest"), "not-json\n");
    await writeFile(resolve(distRoot, "index.html"), "<!doctype html>\n");

    const problems = checkPwaBuiltContract({ frontendRoot, distRoot });

    expect(problems).toContain("Built manifest is not valid JSON");
    expect(problems.some(entry => entry.includes("Built service worker is missing"))).toBe(true);
  });

  it("rejects worker output containing an unresolved source-policy symbol", async () => {
    const frontendRoot = await temporaryFrontend();
    const distRoot = resolve(frontendRoot, "dist");
    await mkdir(distRoot, { recursive: true });
    await writeFile(resolve(distRoot, "manifest.webmanifest"), "not-json\n");
    await writeFile(resolve(distRoot, "index.html"), "<!doctype html>\n");
    await writeFile(resolve(distRoot, "sw.js"), "const prefix = PWA_POLICY.apiPathPrefix;\n");

    const problems = checkPwaBuiltContract({ frontendRoot, distRoot });

    expect(problems).toContain("Built service worker contains an unresolved PWA_POLICY reference");
  });
});
