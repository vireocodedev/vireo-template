import React from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import { PageOverlayOutlet, VireoPage, VireoPageBody } from "@vireocodedev/ui";
import { useLocation } from "react-router";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";

const pageScrollPositions = new Map<string, number>();
const MAX_RETAINED_PAGE_SCROLL_POSITIONS = 50;

function rememberPageScrollPosition(locationKey: string, scrollTop: number) {
  pageScrollPositions.delete(locationKey);
  pageScrollPositions.set(locationKey, scrollTop);
  if (pageScrollPositions.size > MAX_RETAINED_PAGE_SCROLL_POSITIONS) {
    const oldestKey = pageScrollPositions.keys().next().value;
    if (oldestKey) pageScrollPositions.delete(oldestKey);
  }
}

export type AppPageLayoutProps = React.PropsWithChildren<{
  header?: React.ReactNode;
  paddingOnCompact?: boolean;
  scrollMode?: "page" | "contained";
}>;

export function AppPageLayout({ children, header, paddingOnCompact = true, scrollMode = "page" }: AppPageLayoutProps) {
  const theme = useTheme();
  const location = useLocation();
  const scrollRegionRef = React.useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery(theme.breakpoints.up("sm"));
  const preferences = sigAppPreferences.value;
  const maxWidth = preferences.pageWidth === "full" ? false : preferences.pageWidth;
  const docked = desktop && preferences.desktopSurface === "dockedSidePanel";
  const overlayOutlet = <PageOverlayOutlet />;

  React.useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return undefined;

    scrollRegion.scrollTop = pageScrollPositions.get(location.key) ?? 0;
    return () => rememberPageScrollPosition(location.key, scrollRegion.scrollTop);
  }, [location.key]);

  return (
    <VireoPage
      measureParent
      sx={{
        flex: 1,
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {header}
      <VireoPageBody
        drawer={docked ? overlayOutlet : undefined}
        maxWidth={maxWidth}
        paddingOnCompact={paddingOnCompact}
        slotProps={{
          content: {
            ref: scrollRegionRef,
            "data-app-page-scroll-region": true,
            ...(scrollMode === "contained" && { sx: { minHeight: 0, overflow: "hidden" } }),
          },
          ...(scrollMode === "contained" && {
            container: {
              sx: {
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              },
            },
          }),
        }}
      >
        {children}
      </VireoPageBody>
      {!docked && overlayOutlet}
    </VireoPage>
  );
}
