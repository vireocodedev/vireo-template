import { createSqliteWorkerRuntime } from "@vireocodedev/sqlite";
import { appOfflineWorkerConfig } from "./app-offline-sqlite";

createSqliteWorkerRuntime(appOfflineWorkerConfig).attach(self);
