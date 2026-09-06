import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath, searchForWorkspaceRoot } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { APP_IDENTITY, PWA_POLICY, createPwaManifest } from "./pwa-policy.mjs";
import { transformAppIdentityHtml } from "./scripts/app-identity-html.mjs";
import { signalsReactTransform } from "./config/signals-react-transform.ts";

const directory = path.dirname(fileURLToPath(import.meta.url));
const USE_LOCAL_STARTER_DIST = process.env.USE_LOCAL_STARTER === "true";
const USE_LOCAL_STARTER_SOURCE = process.env.USE_LOCAL_STARTER_SOURCE === "true";
const USE_LOCAL_STARTER = USE_LOCAL_STARTER_DIST || USE_LOCAL_STARTER_SOURCE;
const IS_STORYBOOK = process.env.STORYBOOK === "true";
const BUILD_REVISION = process.env.VIREO_BUILD_REVISION ?? "development";

/**
 * Expected workspace layout:
 *
 * vireocode/
 * ├── vireo/
 * └── vireo-template/
 *     └── frontend/
 *
 * Source mode is the normal local-development path: Vite consumes Starter's
 * public TypeScript entry points directly and owns the only required watcher.
 * Dist mode remains available for explicitly testing emitted package output.
 */
const STARTER_ROOT = path.resolve(directory, "../../vireo");
const STARTER_PACKAGES_ROOT = path.resolve(STARTER_ROOT, "packages");

const LOCAL_STARTER_PACKAGE_DIRECTORIES = [
  "history",
  "infrastructure",
  "localization",
  "queryengine",
  "shell",
  "sqlite",
  "ui",
] as const;

function starterDistDirectory(packageDirectory: string): string {
  return normalizePath(path.resolve(STARTER_PACKAGES_ROOT, packageDirectory, "dist"));
}

function starterDistEntry(packageDirectory: string, entry = "index.js"): string {
  return normalizePath(path.resolve(STARTER_PACKAGES_ROOT, packageDirectory, "dist", entry));
}

const LOCAL_STARTER_DIST_DIRECTORIES = LOCAL_STARTER_PACKAGE_DIRECTORIES.map(starterDistDirectory);
const STARTER_NODE_MODULES = normalizePath(path.resolve(STARTER_ROOT, "node_modules"));
const STARTER_UI_DIST = starterDistDirectory("ui");
const STARTER_UI_SOURCE = normalizePath(path.resolve(STARTER_PACKAGES_ROOT, "ui/src"));

function starterSourceEntry(packageDirectory: string, entry = "index.ts"): string {
  return normalizePath(path.resolve(STARTER_PACKAGES_ROOT, packageDirectory, "src", entry));
}

function localStarterEntry(packageDirectory: string, distEntry: string, sourceEntry: string): string {
  return USE_LOCAL_STARTER_SOURCE
    ? starterSourceEntry(packageDirectory, sourceEntry)
    : starterDistEntry(packageDirectory, distEntry);
}

function localStarterUiEntry(distEntry: string, sourceEntry: string): string {
  return USE_LOCAL_STARTER_SOURCE
    ? normalizePath(path.resolve(STARTER_UI_SOURCE, sourceEntry))
    : normalizePath(path.resolve(STARTER_UI_DIST, distEntry));
}

const localStarterAliases = USE_LOCAL_STARTER
  ? [
      // Match declared subpath exports before their package roots.
      {
        find: /^@vireocodedev\/infrastructure\/network-status$/,
        replacement: localStarterEntry("infrastructure", "network/appNetworkStatus.js", "network/appNetworkStatus.ts"),
      },
      {
        find: /^@vireocodedev\/infrastructure\/pagination$/,
        replacement: localStarterEntry("infrastructure", "http/pagination.js", "http/pagination.ts"),
      },
      {
        find: /^@vireocodedev\/sqlite\/offline$/,
        replacement: localStarterEntry("sqlite", "offline/index.js", "offline/index.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/country$/,
        replacement: localStarterUiEntry("capabilities/country/public.js", "capabilities/country/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/forms$/,
        replacement: localStarterUiEntry("capabilities/forms/public.js", "capabilities/forms/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/event-source$/,
        replacement: localStarterUiEntry("integrations/event-source/public.js", "integrations/event-source/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/hello-pangea-dnd$/,
        replacement: localStarterUiEntry(
          "integrations/hello-pangea-dnd/public.js",
          "integrations/hello-pangea-dnd/public.ts",
        ),
      },
      {
        find: /^@vireocodedev\/ui\/localization$/,
        replacement: localStarterUiEntry("integrations/localization/public.js", "integrations/localization/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/react-i18next$/,
        replacement: localStarterUiEntry(
          "integrations/react-i18next/public.js",
          "integrations/react-i18next/public.ts",
        ),
      },
      {
        find: /^@vireocodedev\/ui\/sonner$/,
        replacement: localStarterUiEntry("integrations/sonner/public.js", "integrations/sonner/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/tanstack-query$/,
        replacement: localStarterUiEntry(
          "integrations/tanstack-query/public.js",
          "integrations/tanstack-query/public.ts",
        ),
      },
      {
        find: /^@vireocodedev\/history$/,
        replacement: localStarterEntry("history", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/infrastructure$/,
        replacement: localStarterEntry("infrastructure", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/localization$/,
        replacement: localStarterEntry("localization", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/query$/,
        replacement: localStarterEntry("queryengine", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/shell$/,
        replacement: localStarterEntry("shell", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/sqlite$/,
        replacement: localStarterEntry("sqlite", "index.js", "index.ts"),
      },
      {
        find: /^@vireocodedev\/ui$/,
        replacement: localStarterEntry("ui", "index.js", "index.ts"),
      },
    ]
  : [];

const activeStarterUiRoot = USE_LOCAL_STARTER_SOURCE ? STARTER_UI_SOURCE : STARTER_UI_DIST;
const localStarterUiInternalAliases = USE_LOCAL_STARTER
  ? ["capabilities", "core", "integrations"].map(directoryName => ({
      find: `@/${directoryName}`,
      replacement: `${activeStarterUiRoot}/${directoryName}`,
    }))
  : [];

const appIdentityHtmlPlugin = {
  name: "vireo-app-identity-html",
  transformIndexHtml(html: string) {
    return transformAppIdentityHtml(html, APP_IDENTITY, BUILD_REVISION);
  },
};

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "mui", test: /node_modules\/@mui\//u },
            { name: "react", test: /node_modules\/(?:react|react-dom|react-router)\//u },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    signalsReactTransform(),
    appIdentityHtmlPlugin,
    ...(!IS_STORYBOOK
      ? [
          VitePWA({
            registerType: "prompt",
            manifest: createPwaManifest(),
            workbox: {
              navigateFallbackDenylist: [new RegExp(PWA_POLICY.workbox.navigationDenylistPathPatternSource, "u")],
              runtimeCaching: [
                {
                  // Workbox RegExpRoute matches against the absolute URL. A leading
                  // anchor would therefore prevent same-origin pathname matches.
                  urlPattern: new RegExp(PWA_POLICY.workbox.runtimeUrlPatternSource, "u"),
                  handler: PWA_POLICY.workbox.runtimeHandler,
                },
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: [
      ...localStarterAliases,
      ...localStarterUiInternalAliases,
      { find: "@", replacement: path.resolve(directory, "src") },
    ],
    // Source mode crosses package boundaries, so all shared runtime singletons
    // must resolve from the application's dependency graph.
    dedupe: [
      "@emotion/react",
      "@emotion/styled",
      "@mui/icons-material",
      "@mui/material",
      "@mui/x-date-pickers",
      "@preact/signals-react",
      "@tanstack/react-form",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "dayjs",
      "i18next",
      "react",
      "react-dom",
      "react-i18next",
      "sonner",
      "zod",
    ],
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    ...(USE_LOCAL_STARTER
      ? {
          fs: {
            allow: [
              searchForWorkspaceRoot(directory),
              STARTER_NODE_MODULES,
              ...(USE_LOCAL_STARTER_SOURCE ? [STARTER_PACKAGES_ROOT] : LOCAL_STARTER_DIST_DIRECTORIES),
            ],
          },
        }
      : {}),
    ...(USE_LOCAL_STARTER_SOURCE
      ? {
          watch: {
            ignored: [`${STARTER_PACKAGES_ROOT}/**/dist/**`],
          },
        }
      : {}),
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      [PWA_POLICY.readinessPath]: { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
