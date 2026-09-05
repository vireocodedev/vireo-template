import { APP_THEME_COMPONENTS } from "@/app/ui/theme/config/theme.components";
import { APP_THEME_DARK_COLOR_SCHEME } from "@/app/ui/theme/config/theme.dark";
import { APP_THEME_LIGHT_COLOR_SCHEME } from "@/app/ui/theme/config/theme.light";
import { APP_SURFACES_DARK, APP_SURFACES_LIGHT } from "@/app/ui/theme/config/theme.surfaces";
import { APP_THEME } from "@/app/ui/theme/config/theme";
import { alertClasses } from "@mui/material";
import { describe, expect, it } from "vitest";

describe("application themes", () => {
  it("defines independent light and dark application color schemes", () => {
    expect(APP_THEME_LIGHT_COLOR_SCHEME.palette).toMatchObject({
      mode: "light",
      primary: { main: "#006c98" },
      background: {
        default: "#f6f7f9",
        paper: "#ffffff",
      },
      appSurface: {
        canvas: "#f6f7f9",
        screen: "#ffffff",
        recessed: "#f0f2f4",
        content: "#ffffff",
        control: "#f6f7f9",
        elevated: "#f0f2f4",
        chrome: "#ffffff",
        overlay: "#ffffff",
      },
      divider: "#d5d8dd",
    });

    expect(APP_THEME_DARK_COLOR_SCHEME.palette).toMatchObject({
      mode: "dark",
      primary: { main: "#69d9ff" },
      background: {
        default: "#0b0c0e",
        paper: "#111315",
      },
      appSurface: {
        canvas: "#0b0c0e",
        screen: "#111315",
        recessed: "#0b0c0e",
        content: "#111315",
        control: "#181a1e",
        elevated: "#1a1c20",
        chrome: "#1a1c20",
        overlay: "#111315",
      },
      divider: "#303238",
    });
  });

  it("assembles both schemes into one CSS-variable theme", () => {
    expect(APP_THEME.colorSchemes.light?.palette.background).toMatchObject({
      default: "#f6f7f9",
      paper: "#ffffff",
    });
    expect(APP_THEME.colorSchemes.dark?.palette.background).toMatchObject({
      default: "#0b0c0e",
      paper: "#111315",
    });
  });

  it("shares component policy across both themes", () => {
    expect(APP_THEME_COMPONENTS?.MuiCssBaseline?.styleOverrides).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiCard?.defaultProps).toMatchObject({
      elevation: 0,
      variant: "outlined",
    });
    expect(APP_THEME_COMPONENTS?.MuiButton?.defaultProps).toMatchObject({
      disableElevation: true,
    });
    expect(APP_THEME_COMPONENTS?.MuiButton?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiIconButton?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiDialogActions?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiTableRow?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiTableHead?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiOutlinedInput?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.MuiMenuItem?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoApplicationNavigationItem?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoMobileBottomNavigation?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoActionPreviewButton?.styleOverrides?.preview).toMatchObject({ opacity: 1 });
    expect(APP_THEME_COMPONENTS?.VireoPage?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoPageHeader?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoOverlayHeader?.styleOverrides?.root).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoFormSection?.styleOverrides?.layout).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoFormSection?.styleOverrides?.content).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoPreferencePanel?.styleOverrides?.item).toBeDefined();
    expect(APP_THEME_COMPONENTS?.VireoResponsiveTable?.styleOverrides?.root).toBeDefined();
    expect(Object.keys(APP_THEME.components ?? {})).toEqual(
      expect.arrayContaining(["VireoOverlayHeader", "VireoPageHeader", "VireoPreferencePanel", "VireoResponsiveTable"]),
    );
    expect(APP_THEME.components?.MuiCard?.defaultProps).toMatchObject({
      elevation: 0,
      variant: "outlined",
    });
  });

  it("defaults structural borders to the semantic divider instead of currentColor", () => {
    const baseline = APP_THEME_COMPONENTS?.MuiCssBaseline?.styleOverrides;
    expect(typeof baseline).toBe("function");

    const styles = typeof baseline === "function" ? baseline(APP_THEME) : baseline;

    expect(styles).toMatchObject({
      "*, *::before, *::after": { borderColor: APP_THEME.palette.divider },
    });
  });

  it("keeps compatibility surface aliases aligned with the semantic roles", () => {
    for (const scheme of [APP_THEME_LIGHT_COLOR_SCHEME, APP_THEME_DARK_COLOR_SCHEME]) {
      const surface = scheme.palette?.appSurface;
      expect(surface?.sunken).toBe(surface?.recessed);
      expect(surface?.base).toBe(surface?.content);
      expect(surface?.raised).toBe(surface?.elevated);
    }
  });

  it("collapses semantic surface roles onto small neutral ramps", () => {
    expect(new Set(Object.values(APP_SURFACES_LIGHT))).toHaveLength(3);
    expect(new Set(Object.values(APP_SURFACES_DARK))).toHaveLength(4);

    for (const color of [...Object.values(APP_SURFACES_LIGHT), ...Object.values(APP_SURFACES_DARK)]) {
      const channels = color.match(/[0-9a-f]{2}/gi)?.map(channel => Number.parseInt(channel, 16)) ?? [];
      expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(8);
    }
  });

  it("uses the system reduced-motion preference and semantic application timing", () => {
    expect(APP_THEME.motion.reducedMotion).toBe("system");
    expect(APP_THEME.transitions.duration.standard).toBe(APP_THEME.appMotion.duration.standard);
    expect(APP_THEME.transitions.duration.enteringScreen).toBe(APP_THEME.appMotion.duration.enter);
  });

  it("uses responsive page surfaces while preserving the canvas grid in every mode", () => {
    const pageRoot = APP_THEME_COMPONENTS?.VireoPage?.styleOverrides?.root;
    expect(typeof pageRoot).toBe("function");

    const compactStyles =
      typeof pageRoot === "function"
        ? pageRoot({ ownerState: { mode: "compact" }, theme: APP_THEME } as never)
        : pageRoot;
    const regularStyles =
      typeof pageRoot === "function"
        ? pageRoot({ ownerState: { mode: "regular" }, theme: APP_THEME } as never)
        : pageRoot;
    const expectedGrid = `linear-gradient(color-mix(in srgb, ${APP_THEME.palette.divider} 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${APP_THEME.palette.divider} 16%, transparent) 1px, transparent 1px)`;

    expect(compactStyles).toMatchObject({
      backgroundColor: APP_THEME.palette.appSurface.screen,
      backgroundImage: expectedGrid,
      backgroundSize: "24px 24px",
    });
    expect(regularStyles).toMatchObject({
      backgroundColor: APP_THEME.palette.appSurface.canvas,
      backgroundImage: expectedGrid,
      backgroundSize: "24px 24px",
    });
  });

  it("keeps overlay headers aligned with mobile and desktop page headers", () => {
    const overlayHeaderRoot = APP_THEME_COMPONENTS?.VireoOverlayHeader?.styleOverrides?.root;
    expect(typeof overlayHeaderRoot).toBe("function");

    const styles =
      typeof overlayHeaderRoot === "function" ? overlayHeaderRoot({ theme: APP_THEME } as never) : overlayHeaderRoot;

    expect(styles).toMatchObject({
      height: 65,
      maxHeight: 65,
      minHeight: 65,
      [APP_THEME.breakpoints.up("md")]: {
        height: 81,
        maxHeight: 81,
        minHeight: 81,
      },
    });
  });

  it("uses compact spacing between form-section fields", () => {
    const formSectionLayout = APP_THEME_COMPONENTS?.VireoFormSection?.styleOverrides?.layout;
    expect(typeof formSectionLayout).toBe("function");

    const styles =
      typeof formSectionLayout === "function" ? formSectionLayout({ theme: APP_THEME } as never) : formSectionLayout;

    expect(styles).toMatchObject({ gap: APP_THEME.spacing(1) });
  });

  it("keeps desktop dialog and overlay action footers aligned with the navigation footer", () => {
    const dialogActionsRoot = APP_THEME_COMPONENTS?.MuiDialogActions?.styleOverrides?.root;
    expect(typeof dialogActionsRoot).toBe("function");

    const styles =
      typeof dialogActionsRoot === "function" ? dialogActionsRoot({ theme: APP_THEME } as never) : dialogActionsRoot;

    expect(styles).toMatchObject({
      borderTop: `1px solid ${APP_THEME.palette.divider}`,
      flexShrink: 0,
      [APP_THEME.breakpoints.up("md")]: {
        boxSizing: "border-box",
        height: 81,
        maxHeight: 81,
        minHeight: 81,
      },
    });
  });

  it("turns responsive table cards into screen sections without changing the desktop hierarchy", () => {
    const tableRoot = APP_THEME_COMPONENTS?.VireoResponsiveTable?.styleOverrides?.root;
    expect(typeof tableRoot).toBe("function");

    const mobileStyles =
      typeof tableRoot === "function"
        ? tableRoot({ ownerState: { layout: "mobile", skeleton: false }, theme: APP_THEME } as never)
        : tableRoot;
    const desktopStyles =
      typeof tableRoot === "function"
        ? tableRoot({ ownerState: { layout: "desktop", skeleton: false }, theme: APP_THEME } as never)
        : tableRoot;

    expect(mobileStyles).toMatchObject({
      backgroundColor: APP_THEME.palette.appSurface.screen,
      "& .MuiAccordionSummary-root": { backgroundColor: APP_THEME.palette.appSurface.screen },
      "& .MuiAccordionDetails-root": { backgroundColor: APP_THEME.palette.appSurface.screen },
    });
    expect(desktopStyles).toMatchObject({
      backgroundColor: APP_THEME.palette.appSurface.content,
      "& .MuiTableContainer-root": { backgroundColor: APP_THEME.palette.appSurface.content },
    });
  });

  it("shows a neutral background when hovering table rows", () => {
    const tableRowRoot = APP_THEME_COMPONENTS?.MuiTableRow?.styleOverrides?.root;
    expect(typeof tableRowRoot).toBe("function");

    const styles = typeof tableRowRoot === "function" ? tableRowRoot({ theme: APP_THEME } as never) : tableRowRoot;

    expect(styles).toMatchObject({
      "&.MuiTableRow-hover:hover": {
        backgroundColor: `color-mix(in srgb, ${APP_THEME.palette.appSurface.elevated} 72%, ${APP_THEME.palette.appSurface.content})`,
      },
    });
  });

  it("maps primary work areas, outlined fields, and inset cards to their semantic surface roles", () => {
    const inputRoot = APP_THEME_COMPONENTS?.MuiOutlinedInput?.styleOverrides?.root;
    const cardRoot = APP_THEME_COMPONENTS?.MuiCard?.styleOverrides?.root;
    const preferenceItem = APP_THEME_COMPONENTS?.VireoPreferencePanel?.styleOverrides?.item;
    expect(typeof inputRoot).toBe("function");
    expect(typeof cardRoot).toBe("function");
    expect(typeof preferenceItem).toBe("function");

    const inputStyles = typeof inputRoot === "function" ? inputRoot({ theme: APP_THEME } as never) : inputRoot;
    const cardStyles =
      typeof cardRoot === "function"
        ? cardRoot({ ownerState: { variant: "inset" }, theme: APP_THEME } as never)
        : cardRoot;
    const preferenceItemStyles =
      typeof preferenceItem === "function"
        ? preferenceItem({ ownerState: { isCompact: false }, theme: APP_THEME } as never)
        : preferenceItem;

    expect(inputStyles).toMatchObject({
      backgroundColor: APP_THEME.palette.appSurface.control,
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: APP_THEME.palette.primary.main },
      "&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: APP_THEME.palette.error.main,
      },
    });
    expect(cardStyles).toMatchObject({ backgroundColor: APP_THEME.palette.appSurface.recessed });
    expect(preferenceItemStyles).toMatchObject({ backgroundColor: APP_THEME.palette.appSurface.content });
    expect(APP_THEME_COMPONENTS?.MuiMenuItem?.styleOverrides?.root).toMatchObject({
      "&&": { minHeight: 48, paddingBlock: 10 },
    });
  });

  it("keeps default chips neutral instead of spending primary emphasis", () => {
    const chipRoot = APP_THEME_COMPONENTS?.MuiChip?.styleOverrides?.root;
    expect(typeof chipRoot).toBe("function");

    const styles = typeof chipRoot === "function" ? chipRoot({ theme: APP_THEME } as never) : chipRoot;

    expect(styles).toMatchObject({
      "&.MuiChip-colorDefault.MuiChip-filled": {
        backgroundColor: APP_THEME.palette.appSurface.elevated,
      },
    });
  });

  it("keeps light standard alerts distinct from recessed surfaces with severity-colored accents", () => {
    const alertRoot = APP_THEME_COMPONENTS?.MuiAlert?.styleOverrides?.root;
    expect(typeof alertRoot).toBe("function");

    const styles = typeof alertRoot === "function" ? alertRoot({ theme: APP_THEME } as never) : alertRoot;
    const lightStyles = APP_THEME.applyStyles("light", {
      [`&.${alertClasses.standard}.${alertClasses.colorError}`]: {
        backgroundColor: `color-mix(in srgb, ${APP_THEME.palette.error.main} 12%, ${APP_THEME.palette.appSurface.content})`,
      },
      [`&.${alertClasses.standard}.${alertClasses.colorInfo}`]: {
        backgroundColor: `color-mix(in srgb, ${APP_THEME.palette.info.main} 12%, ${APP_THEME.palette.appSurface.content})`,
      },
      [`&.${alertClasses.standard}.${alertClasses.colorSuccess}`]: {
        backgroundColor: `color-mix(in srgb, ${APP_THEME.palette.success.main} 12%, ${APP_THEME.palette.appSurface.content})`,
      },
      [`&.${alertClasses.standard}.${alertClasses.colorWarning}`]: {
        backgroundColor: `color-mix(in srgb, ${APP_THEME.palette.warning.main} 12%, ${APP_THEME.palette.appSurface.content})`,
      },
    });

    expect(styles).toMatchObject({
      borderInlineStart: "3px solid transparent",
      "&.MuiAlert-colorError": { borderInlineStartColor: APP_THEME.palette.error.main },
      "&.MuiAlert-colorInfo": { borderInlineStartColor: APP_THEME.palette.info.main },
      "&.MuiAlert-colorSuccess": { borderInlineStartColor: APP_THEME.palette.success.main },
      "&.MuiAlert-colorWarning": { borderInlineStartColor: APP_THEME.palette.warning.main },
      ...lightStyles,
    });
    expect(styles).not.toHaveProperty("backgroundColor");
  });

  it("uses compact screen backgrounds without adding panel shadows", () => {
    const panelRoot = APP_THEME_COMPONENTS?.VireoPreferencePanel?.styleOverrides?.root;
    const item = APP_THEME_COMPONENTS?.VireoPreferencePanel?.styleOverrides?.item;
    expect(typeof panelRoot).toBe("function");
    expect(typeof item).toBe("function");

    const ownerState = { isCompact: true };
    const rootStyles =
      typeof panelRoot === "function" ? panelRoot({ ownerState, theme: APP_THEME } as never) : panelRoot;
    const itemStyles = typeof item === "function" ? item({ ownerState, theme: APP_THEME } as never) : item;

    expect(rootStyles).toMatchObject({ backgroundColor: APP_THEME.palette.appSurface.screen });
    expect(rootStyles).not.toHaveProperty("boxShadow");
    expect(itemStyles).toMatchObject({ backgroundColor: APP_THEME.palette.appSurface.screen });
  });

  it("removes tactile transforms and transition time for reduced-motion users", () => {
    const buttonRoot = APP_THEME_COMPONENTS?.MuiButton?.styleOverrides?.root;
    const iconButtonRoot = APP_THEME_COMPONENTS?.MuiIconButton?.styleOverrides?.root;
    expect(typeof buttonRoot).toBe("function");
    expect(typeof iconButtonRoot).toBe("function");

    const buttonStyles = typeof buttonRoot === "function" ? buttonRoot({ theme: APP_THEME } as never) : buttonRoot;
    const iconButtonStyles =
      typeof iconButtonRoot === "function" ? iconButtonRoot({ theme: APP_THEME } as never) : iconButtonRoot;
    expect(buttonStyles).toMatchObject({
      "@media (prefers-reduced-motion: reduce)": {
        transitionDuration: "0ms",
        "&:active:not(.Mui-disabled)": { transform: "none" },
      },
    });
    expect(iconButtonStyles).toMatchObject({
      "@media (prefers-reduced-motion: reduce)": {
        transitionDuration: "0ms",
        "&:active:not(.Mui-disabled)": { transform: "none" },
      },
    });
  });
});
