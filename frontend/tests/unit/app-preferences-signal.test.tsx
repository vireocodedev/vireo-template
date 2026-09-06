import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { initSignalEffects } from "@/app/init-signal-effects";
import { resetAppPreferences, updateAppPreference } from "@/app/ui/preferences/actions/app-preferences-actions";
import { DEFAULT_APP_PREFERENCES } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";

const PREFERENCES_STORAGE_KEY = "starter-template:preferences";

function PreferenceProbe() {
  return <output>{sigAppPreferences.value.tableSize}</output>;
}

describe("app preferences signal", () => {
  beforeEach(() => {
    localStorage.clear();
    sigAppPreferences.value = DEFAULT_APP_PREFERENCES;
  });

  it("reactively updates components without a provider", () => {
    render(<PreferenceProbe />);
    expect(screen.getByText("medium")).toBeVisible();

    act(() => updateAppPreference("tableSize", "small"));

    expect(screen.getByText("small")).toBeVisible();
  });

  it("persists updates and removes the stored value on reset", () => {
    initSignalEffects();
    updateAppPreference("darkMode", false);

    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "null")).toEqual({
      ...DEFAULT_APP_PREFERENCES,
      darkMode: false,
    });

    resetAppPreferences();

    expect(sigAppPreferences.value).toEqual(DEFAULT_APP_PREFERENCES);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
