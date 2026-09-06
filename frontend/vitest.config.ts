import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import { signalsReactTransform } from "./config/signals-react-transform.ts";

const useLocalStarter = process.env.USE_LOCAL_STARTER === "true";
const useLocalStarterSource = process.env.USE_LOCAL_STARTER_SOURCE === "true";
const localStarterUiEntry = path.resolve(import.meta.dirname, "../../vireo/packages/ui/dist/index.js");
const localStarterUiFormsEntry = path.resolve(
  import.meta.dirname,
  "../../vireo/packages/ui/dist/capabilities/forms/public.js",
);
const localStarterUiLocalizationEntry = path.resolve(
  import.meta.dirname,
  "../../vireo/packages/ui/dist/integrations/localization/public.js",
);
const localStarterUiSource = path.resolve(import.meta.dirname, "../../vireo/packages/ui/src");
const frontendNodeModules = path.resolve(import.meta.dirname, "node_modules");

const localRuntimeAliases =
  useLocalStarter || useLocalStarterSource
    ? [
        { find: /^react$/, replacement: path.resolve(frontendNodeModules, "react/index.js") },
        { find: /^react\/(.+)$/, replacement: `${path.resolve(frontendNodeModules, "react")}/$1` },
        { find: /^react-dom$/, replacement: path.resolve(frontendNodeModules, "react-dom/index.js") },
        { find: /^react-dom\/(.+)$/, replacement: `${path.resolve(frontendNodeModules, "react-dom")}/$1` },
        {
          find: /^@tanstack\/react-form$/,
          replacement: path.resolve(frontendNodeModules, "@tanstack/react-form/dist/esm/index.js"),
        },
        { find: /^@mui\/material$/, replacement: path.resolve(frontendNodeModules, "@mui/material/index.js") },
        {
          find: /^@mui\/material\/(.+)$/,
          replacement: `${path.resolve(frontendNodeModules, "@mui/material")}/$1`,
        },
        {
          find: /^@mui\/icons-material$/,
          replacement: path.resolve(frontendNodeModules, "@mui/icons-material/index.js"),
        },
        {
          find: /^@mui\/icons-material\/(.+)$/,
          replacement: `${path.resolve(frontendNodeModules, "@mui/icons-material")}/$1`,
        },
        {
          find: /^@mui\/x-date-pickers$/,
          replacement: path.resolve(frontendNodeModules, "@mui/x-date-pickers/index.js"),
        },
        {
          find: /^@mui\/x-date-pickers\/(.+)$/,
          replacement: `${path.resolve(frontendNodeModules, "@mui/x-date-pickers")}/$1`,
        },
        { find: /^@emotion\/react$/, replacement: path.resolve(frontendNodeModules, "@emotion/react") },
        { find: /^@emotion\/styled$/, replacement: path.resolve(frontendNodeModules, "@emotion/styled") },
        { find: /^zod$/, replacement: path.resolve(frontendNodeModules, "zod/index.js") },
        { find: /^dayjs$/, replacement: path.resolve(frontendNodeModules, "dayjs/dayjs.min.js") },
      ]
    : [];

const localStarterSourceAliases = useLocalStarterSource
  ? [
      {
        find: /^@vireocodedev\/ui\/forms$/,
        replacement: path.resolve(localStarterUiSource, "capabilities/forms/public.ts"),
      },
      {
        find: /^@vireocodedev\/ui\/localization$/,
        replacement: path.resolve(localStarterUiSource, "integrations/localization/public.ts"),
      },
      { find: /^@vireocodedev\/ui$/, replacement: path.resolve(localStarterUiSource, "index.ts") },
      { find: "@/capabilities", replacement: path.resolve(localStarterUiSource, "capabilities") },
      { find: "@/core", replacement: path.resolve(localStarterUiSource, "core") },
      { find: "@/integrations", replacement: path.resolve(localStarterUiSource, "integrations") },
    ]
  : [];

const localStarterDistAliases = useLocalStarter
  ? [
      { find: /^@vireocodedev\/ui\/forms$/, replacement: localStarterUiFormsEntry },
      { find: /^@vireocodedev\/ui\/localization$/, replacement: localStarterUiLocalizationEntry },
      { find: /^@vireocodedev\/ui$/, replacement: localStarterUiEntry },
    ]
  : [];

export default defineConfig({
  plugins: [react(), signalsReactTransform()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "i18next",
      "react-i18next",
      "zod",
      "@tanstack/react-query",
      "@preact/signals-react",
      "axios",
      "dayjs",
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-date-pickers",
      "@vireocodedev/ui",
      "react-router",
      "sonner",
    ],
    alias: [
      ...localRuntimeAliases,
      ...localStarterSourceAliases,
      ...localStarterDistAliases,
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      {
        find: "virtual:pwa-register/react",
        replacement: fileURLToPath(new URL("./tests/mocks/pwa-register-react.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    // Local Starter entry points fan out across the complete UI contract. Keep
    // worker startup bounded so verification remains deterministic on normal
    // developer machines instead of compiling that graph in every CPU core at
    // once.
    maxWorkers: 2,
    // Inline the ui package so vitest transforms it through vite; its dist
    // uses MUI subpath imports (e.g. @mui/x-date-pickers/DatePicker) that
    // Node's resolver rejects as directory imports.
    server: {
      deps: {
        inline: ["@vireocodedev/ui", "@vireocodedev/shell"],
      },
    },
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
      "tests/contract/**/*.{test,spec}.{ts,mjs}",
    ],
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    globals: true,
    setupFiles: ["tests/setup.ts"],
  },
});
