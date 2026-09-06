import "@fontsource-variable/inter";
import "./main.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import { appConfig } from "@/app/config/app-config";
import { AppErrorBoundary } from "@/app/shell/components/AppErrorBoundary";
import { initSignalEffects } from "@/app/init-signal-effects";

if (appConfig.apiMode === "mock") {
  const { installMockAppAdapters } = await import("@/app/adapters/mock/app.mock-adapters");
  installMockAppAdapters();
}
initSignalEffects();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary scope="root">
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
