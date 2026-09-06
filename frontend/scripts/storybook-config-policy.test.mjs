import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { loadConfigFromFile } from "vite";

const configPath = resolve(import.meta.dirname, "..", "vitest.storybook.config.ts");

test("Storybook prebundles its public testing boundary for minimal story surfaces", async () => {
  const loaded = await loadConfigFromFile({ command: "serve", mode: "test" }, configPath);
  const config = loaded?.config;

  assert.ok(config, "Vitest Storybook configuration must load");
  assert.deepEqual(config.optimizeDeps?.include, [
    "@preact/signals-react/runtime",
    "@testing-library/dom",
    "@vireocodedev/sqlite",
  ]);

  const projects = config.test?.projects;
  assert.ok(Array.isArray(projects), "Storybook browser projects must remain configured");
  assert.deepEqual(
    projects.map(project => project.test?.name),
    ["storybook", "storybook-reduced-motion"],
  );
  assert.ok(projects.every(project => project.extends === true));
});
