import { DEFAULT_APP_PREFERENCES, type AppPreferences } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { createAppPreferencesStorage } from "@/app/ui/preferences/services/app-preferences-storage";

const preferencesStorage = createAppPreferencesStorage();

export function updateAppPreference<TKey extends keyof AppPreferences>(key: TKey, value: AppPreferences[TKey]): void {
  sigAppPreferences.value = { ...sigAppPreferences.value, [key]: value };
}

export function resetAppPreferences(): void {
  sigAppPreferences.value = DEFAULT_APP_PREFERENCES;
  preferencesStorage.remove();
}
