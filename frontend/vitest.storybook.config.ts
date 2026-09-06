import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Storybook's interaction runtime reaches this public boundary even when a
    // generated application has only a minimal set of stories. Prebundle the
    // package entry point so its CommonJS aria-query/lz-string dependencies do
    // not become native ESM imports in the browser test runtime. The Signals
    // transform injects its runtime import, which must also be ready before the
    // browser projects start so Vite does not reload them mid-run.
    optimizeDeps: {
      include: ["@preact/signals-react/runtime", "@testing-library/dom", "@vireocodedev/sqlite"],
    },
    test: {
      testTimeout: 30_000,
      projects: [
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") })],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [
                { browser: "chromium", name: "desktop", viewport: { height: 900, width: 1440 } },
                { browser: "chromium", name: "mobile", viewport: { height: 844, width: 390 } },
              ],
            },
          },
        },
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") })],
          test: {
            name: "storybook-reduced-motion",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({ contextOptions: { reducedMotion: "reduce" } }),
              instances: [{ browser: "chromium", name: "desktop-reduced", viewport: { height: 900, width: 1440 } }],
            },
          },
        },
      ],
    },
  }),
);
