import { defineConfig, devices } from "@playwright/test";

import { parallelPlaywrightPolicy } from "./playwright.policy";

const useLocalStarter = process.env.USE_LOCAL_STARTER_SOURCE === "true";
const browserLane = process.env.VIREO_E2E_BROWSER ?? "chromium";
const webServerStartupTimeout = 90_000;
const frontendDevCommand = useLocalStarter ? "corepack npm run dev:local-starter" : "corepack npm run dev";
const backendGradleCommand = `../gradlew -p .. bootRun${useLocalStarter ? " -PuseLocalStarter=true" : ""} --console=plain`;
const backendDevCommand =
  process.env.VIREO_E2E_EXTERNAL_DATABASE === "true"
    ? backendGradleCommand
    : "SPRING_DATASOURCE_URL='jdbc:h2:mem:startertemplatee2e;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1' " +
      `SPRING_DATASOURCE_USERNAME=sa SPRING_DATASOURCE_PASSWORD='' ${backendGradleCommand}`;

const projects =
  browserLane === "firefox"
    ? [{ name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } }]
    : browserLane === "webkit"
      ? [{ name: "desktop-webkit", use: { ...devices["Desktop Safari"] } }]
      : [
          { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
          { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
        ];

if (!new Set(["chromium", "firefox", "webkit"]).has(browserLane)) {
  throw new Error(`Unsupported VIREO_E2E_BROWSER value: ${browserLane}`);
}

export default defineConfig({
  ...parallelPlaywrightPolicy,
  testDir: "./tests/e2e",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: [
    {
      command: backendDevCommand,
      url: "http://127.0.0.1:8080/actuator/health/readiness",
      reuseExistingServer: !process.env.CI,
      timeout: webServerStartupTimeout,
      stdout: process.env.CI ? "pipe" : "ignore",
    },
    {
      command: `${frontendDevCommand} -- --host 127.0.0.1 --strictPort`,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: webServerStartupTimeout,
      stdout: process.env.CI ? "pipe" : "ignore",
    },
  ],
  projects,
});
