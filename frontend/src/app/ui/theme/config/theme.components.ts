import { APP_THEME_TOKENS } from "@/app/ui/theme/config/theme.tokens";
import { alertClasses, type Theme } from "@mui/material";
import type {} from "@vireocodedev/ui";

export const APP_THEME_COMPONENTS: Theme["components"] = {
  MuiCssBaseline: {
    styleOverrides: theme => ({
      "*, *::before, *::after": {
        // CSS otherwise defaults an unspecified border color to currentColor,
        // which turns structural dividers white in dark mode.
        borderColor: theme.palette.divider,
      },
    }),
  },
  VireoApplicationNavigationItem: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        border: "1px solid transparent",
        ...(ownerState.selected && {
          backgroundColor: theme.palette.action.selected,
          borderColor: `color-mix(in srgb, ${theme.palette.primary.main} 42%, ${theme.palette.divider})`,
          boxShadow: `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 8%, transparent)`,
          color: theme.palette.primary.main,
          "&:hover": { backgroundColor: theme.palette.action.selected },
        }),
      }),
      label: ({ ownerState }) => ({
        letterSpacing: ownerState.mode === "compact" ? "0.035em" : "0.01em",
      }),
    },
  },
  VireoMobileBottomNavigation: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.appSurface.chrome,
        borderColor: theme.palette.divider,
        boxShadow: `0 -8px 24px color-mix(in srgb, ${theme.palette.common.black} 12%, transparent)`,
      }),
    },
  },
  VireoActionPreviewButton: {
    styleOverrides: {
      preview: { opacity: 1 },
    },
  },
  VireoPage: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        backgroundColor:
          ownerState.mode === "compact" ? theme.palette.appSurface.screen : theme.palette.appSurface.canvas,
        backgroundImage: `linear-gradient(color-mix(in srgb, ${theme.palette.divider} 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${theme.palette.divider} 16%, transparent) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }),
    },
  },
  VireoPageHeader: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        backgroundColor: theme.palette.appSurface.chrome,
        borderColor: theme.palette.divider,
        gap: theme.spacing(ownerState.mode === "compact" ? 0.5 : 2),
        paddingInline: theme.spacing(ownerState.mode === "compact" ? 1 : 3),
      }),
    },
  },
  VireoOverlayHeader: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: APP_THEME_TOKENS.layout.headerHeight.mobile,
        maxHeight: APP_THEME_TOKENS.layout.headerHeight.mobile,
        minHeight: APP_THEME_TOKENS.layout.headerHeight.mobile,
        [theme.breakpoints.up("md")]: {
          height: APP_THEME_TOKENS.layout.headerHeight.desktop,
          maxHeight: APP_THEME_TOKENS.layout.headerHeight.desktop,
          minHeight: APP_THEME_TOKENS.layout.headerHeight.desktop,
        },
      }),
    },
  },
  VireoPreferencePanel: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        backgroundColor: ownerState.isCompact ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
      }),
      section: ({ ownerState, theme }) => ({
        backgroundColor: ownerState.isCompact ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
        ...(ownerState.isCompact && { borderColor: theme.palette.divider }),
      }),
      sectionHeader: ({ ownerState, theme }) => ({
        backgroundColor: ownerState.isCompact ? theme.palette.appSurface.content : theme.palette.appSurface.elevated,
        ...(ownerState.isCompact && { borderColor: theme.palette.divider }),
      }),
      item: ({ ownerState, theme }) => ({
        backgroundColor: ownerState.isCompact ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
        ...(ownerState.isCompact && { borderColor: theme.palette.divider }),
        "@media (hover: hover)": {
          "&:hover": { backgroundColor: theme.palette.action.hover },
        },
        "@media (hover: none)": {
          "&:hover": {
            backgroundColor: ownerState.isCompact ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
          },
        },
      }),
    },
  },
  // TODO(vireocodedev/vireo#128): move these responsive surface styles to public Vireo slots.
  VireoResponsiveTable: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        backgroundColor:
          ownerState.layout === "mobile" ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
        "& .MuiTableContainer-root": {
          backgroundColor: theme.palette.appSurface.content,
        },
        "& .MuiAccordionSummary-root": {
          backgroundColor:
            ownerState.layout === "mobile" ? theme.palette.appSurface.screen : theme.palette.appSurface.content,
        },
        ...(ownerState.layout === "mobile"
          ? {
              "& [data-responsive-table-mobile-viewport] > .MuiCard-root": {
                backgroundColor: "transparent",
                border: "none",
                borderRadius: 0,
                boxShadow: "none",
              },
              "& .MuiAccordionDetails-root": { backgroundColor: theme.palette.appSurface.screen },
              "& .MuiAccordion-root, & .MuiAccordionDetails-root": {
                borderColor: theme.palette.divider,
              },
            }
          : theme.applyStyles("light", {
              boxShadow: `0 14px 36px color-mix(in srgb, ${theme.palette.common.black} 8%, transparent)`,
            })),
      }),
    },
  },
  VireoFormSection: {
    styleOverrides: {
      layout: ({ theme }) => ({
        gap: theme.spacing(1),
      }),
      content: ({ ownerState, theme }) =>
        ownerState.variant === "outlined"
          ? {
              backgroundColor: theme.palette.appSurface.recessed,
              borderColor: theme.palette.divider,
            }
          : {},
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${theme.palette.common.white} 3%, transparent), transparent 56px)`,
      }),
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        "&.MuiTableRow-hover:hover": {
          backgroundColor: `color-mix(in srgb, ${theme.palette.appSurface.elevated} 72%, ${theme.palette.appSurface.content})`,
        },
      }),
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.appSurface.elevated,
        boxShadow: `inset 0 -1px 0 ${theme.palette.divider}`,
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      head: ({ theme }) => ({
        color: theme.palette.text.secondary,
        fontSize: "0.6875rem",
        fontWeight: 800,
        letterSpacing: "0.075em",
        textTransform: "uppercase",
      }),
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        "&&": {
          minHeight: 48,
          paddingBlock: 10,
        },
      },
    },
  },
  MuiCard: {
    defaultProps: {
      elevation: 0,
      variant: "outlined",
    },
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        backgroundColor:
          ownerState.variant === "inset" ? theme.palette.appSurface.recessed : theme.palette.appSurface.content,
        ...(ownerState.variant === "inset" && { border: `1px solid ${theme.palette.divider}` }),
        borderColor: theme.palette.divider,
        boxShadow: `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 8%, transparent)`,
      }),
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
        [theme.breakpoints.up("md")]: {
          boxSizing: "border-box",
          height: APP_THEME_TOKENS.layout.footerHeight.desktop,
          maxHeight: APP_THEME_TOKENS.layout.footerHeight.desktop,
          minHeight: APP_THEME_TOKENS.layout.footerHeight.desktop,
        },
      }),
    },
  },
  MuiChip: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 4,
        fontWeight: 750,
        letterSpacing: "0.015em",
        "&.MuiChip-colorDefault.MuiChip-filled": {
          backgroundColor: theme.palette.appSurface.elevated,
        },
      }),
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 5,
        minHeight: 40,
        transition: theme.transitions.create(["background-color", "border-color", "box-shadow", "transform"], {
          duration: APP_THEME_TOKENS.motion.duration.micro,
          easing: APP_THEME_TOKENS.motion.easing.standard,
        }),
        "&.MuiButton-contained": {
          boxShadow: `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 22%, transparent), 0 2px 5px color-mix(in srgb, ${theme.palette.common.black} 18%, transparent)`,
        },
        "&.MuiButton-contained:hover": {
          boxShadow: `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 26%, transparent), 0 4px 10px color-mix(in srgb, ${theme.palette.common.black} 20%, transparent)`,
          transform: "translateY(-1px)",
        },
        "&:active:not(.Mui-disabled)": { transform: "translateY(1px) scale(0.99)" },
        "@media (prefers-reduced-motion: reduce)": {
          transitionDuration: "0ms",
          "&:active:not(.Mui-disabled)": { transform: "none" },
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 5,
        transition: theme.transitions.create(["background-color", "color", "transform"], {
          duration: APP_THEME_TOKENS.motion.duration.micro,
          easing: APP_THEME_TOKENS.motion.easing.standard,
        }),
        "&:active:not(.Mui-disabled)": { transform: `scale(${APP_THEME_TOKENS.motion.scale.pressed})` },
        "@media (pointer: coarse)": { minHeight: 44, minWidth: 44 },
        "@media (prefers-reduced-motion: reduce)": {
          transitionDuration: "0ms",
          "&:active:not(.Mui-disabled)": { transform: "none" },
        },
      }),
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.appSurface.control,
        borderRadius: 5,
        boxShadow: `inset 0 1px 2px color-mix(in srgb, ${theme.palette.common.black} 5%, transparent)`,
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.divider,
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.text.secondary,
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.primary.main,
        },
        ...theme.applyStyles("light", {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: `color-mix(in srgb, ${theme.palette.text.secondary} 72%, ${theme.palette.appSurface.control})`,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: `color-mix(in srgb, ${theme.palette.text.primary} 72%, ${theme.palette.appSurface.control})`,
          },
        }),
        ...theme.applyStyles("dark", {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: `color-mix(in srgb, ${theme.palette.text.secondary} 55%, ${theme.palette.appSurface.control})`,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.text.secondary,
          },
        }),
        "&.Mui-error .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.error.main,
        },
        "&.Mui-error:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.error.main,
        },
        "&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: theme.palette.error.main,
        },
      }),
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderInlineStart: "3px solid transparent",
        borderRadius: 4,
        "&.MuiAlert-colorError": { borderInlineStartColor: theme.palette.error.main },
        "&.MuiAlert-colorInfo": { borderInlineStartColor: theme.palette.info.main },
        "&.MuiAlert-colorSuccess": { borderInlineStartColor: theme.palette.success.main },
        "&.MuiAlert-colorWarning": { borderInlineStartColor: theme.palette.warning.main },
        ...theme.applyStyles("light", {
          [`&.${alertClasses.standard}.${alertClasses.colorError}`]: {
            backgroundColor: `color-mix(in srgb, ${theme.palette.error.main} 12%, ${theme.palette.appSurface.content})`,
          },
          [`&.${alertClasses.standard}.${alertClasses.colorInfo}`]: {
            backgroundColor: `color-mix(in srgb, ${theme.palette.info.main} 12%, ${theme.palette.appSurface.content})`,
          },
          [`&.${alertClasses.standard}.${alertClasses.colorSuccess}`]: {
            backgroundColor: `color-mix(in srgb, ${theme.palette.success.main} 12%, ${theme.palette.appSurface.content})`,
          },
          [`&.${alertClasses.standard}.${alertClasses.colorWarning}`]: {
            backgroundColor: `color-mix(in srgb, ${theme.palette.warning.main} 12%, ${theme.palette.appSurface.content})`,
          },
        }),
      }),
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: ({ theme }) => ({
        backgroundColor: theme.palette.text.primary,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 4,
        color: theme.palette.appSurface.overlay,
        fontSize: "0.75rem",
        fontWeight: 650,
        boxShadow: `0 8px 24px color-mix(in srgb, ${theme.palette.common.black} 24%, transparent)`,
        ...theme.applyStyles("dark", {
          backgroundColor: theme.palette.appSurface.elevated,
          color: theme.palette.text.primary,
        }),
      }),
    },
  },
};
