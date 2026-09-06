import { DEFAULT_APP_PREFERENCES } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { AppThemeProvider } from "@/app/ui/theme/AppThemeProvider";
import { Alert, alertClasses } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

function ThemeProbe() {
  const theme = useTheme();
  return (
    <output data-testid="theme" data-mode={theme.palette.mode} data-background={theme.palette.background.default} />
  );
}

describe("AppThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    sigAppPreferences.value = DEFAULT_APP_PREFERENCES;
  });

  it("exposes the selected dark scheme through the active MUI palette", () => {
    sigAppPreferences.value = { ...DEFAULT_APP_PREFERENCES, darkMode: true };

    render(
      <AppThemeProvider>
        <ThemeProbe />
      </AppThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveAttribute("data-mode", "dark");
    expect(screen.getByTestId("theme")).toHaveAttribute("data-background", "#0b0c0e");
    expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#111315");
  });

  it("renders light standard info alerts with the classes targeted by the contrast override", () => {
    render(
      <AppThemeProvider>
        <Alert severity="info">Information</Alert>
      </AppThemeProvider>,
    );

    expect(screen.getByRole("alert")).toHaveClass(alertClasses.standard, alertClasses.colorInfo);
  });
});
