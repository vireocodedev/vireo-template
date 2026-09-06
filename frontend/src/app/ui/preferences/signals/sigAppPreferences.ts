import { signal } from "@preact/signals-react";
import {
  AppPreferencesSchema,
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "@/app/ui/preferences/models/AppPreferences";
import { createAppPreferencesStorage } from "@/app/ui/preferences/services/app-preferences-storage";

const preferencesStorage = createAppPreferencesStorage();

function readInitialPreferences(): AppPreferences {
  const result = AppPreferencesSchema.safeParse(preferencesStorage.read());
  return result.success ? result.data : DEFAULT_APP_PREFERENCES;
}

export const sigAppPreferences = signal<AppPreferences>(readInitialPreferences());
