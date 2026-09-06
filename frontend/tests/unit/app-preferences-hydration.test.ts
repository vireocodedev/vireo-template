import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_PREFERENCES } from "@/app/ui/preferences/models/AppPreferences";

const PREFERENCES_STORAGE_KEY = "starter-template:preferences";

async function loadPreferencesSignal() {
  vi.resetModules();
  return import("@/app/ui/preferences/signals/sigAppPreferences");
}

describe("app preferences signal hydration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates valid stored preferences", async () => {
    const stored = { ...DEFAULT_APP_PREFERENCES, darkMode: false, locale: "hr" as const };
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(stored));

    const { sigAppPreferences } = await loadPreferencesSignal();

    expect(sigAppPreferences.value).toEqual(stored);
  });

  it("applies schema defaults to an older stored preference shape", async () => {
    const stored: Partial<typeof DEFAULT_APP_PREFERENCES> = { ...DEFAULT_APP_PREFERENCES };
    delete stored.locale;
    delete stored.navigationMode;
    delete stored.navigationWidth;
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(stored));

    const { sigAppPreferences } = await loadPreferencesSignal();

    expect(sigAppPreferences.value).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("falls back to defaults for corrupt storage", async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, "{");

    const { sigAppPreferences } = await loadPreferencesSignal();

    expect(sigAppPreferences.value).toEqual(DEFAULT_APP_PREFERENCES);
  });
});
