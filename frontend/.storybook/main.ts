import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile, mergeConfig } from "vite";
import { signalsReactTransform } from "../config/signals-react-transform.ts";

const directory = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../docs/storybook/**/*.mdx", "../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  async viteFinal(viteConfig) {
    const loadedAppConfig = await loadConfigFromFile(
      { command: "build", mode: "production" },
      path.resolve(directory, "../vite.config.ts"),
    );
    const appResolve = loadedAppConfig?.config.resolve;

    return mergeConfig(viteConfig, {
      plugins: [signalsReactTransform()],
      resolve: {
        ...appResolve,
        alias: [
          ...(Array.isArray(appResolve?.alias) ? appResolve.alias : []),
          { find: "@", replacement: path.resolve(directory, "../src") },
        ],
      },
    });
  },
};

export default config;
