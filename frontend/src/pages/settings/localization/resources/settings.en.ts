const en = {
  header: { title: "Settings", description: "Personalize how this workspace behaves and presents data." },
  search: { placeholder: "Search settings", empty: "No preferences match “{{search}}”." },
  sections: { appearance: "Appearance", layout: "Layout", offline: "Offline", defaults: "Defaults" },
  offline: {
    simulation: {
      title: "Offline simulator",
      description: "Keep this tab offline and suppress the realtime stream.",
      unavailable: "Reload the app. If offline storage stays unavailable, use HTTPS or localhost.",
    },
    replayFailure: {
      title: "Fail next replay",
      description: "Make the next queued replay fail once so retry behavior can be inspected.",
    },
    status: {
      title: "Offline status",
      description: "{{connection}} · cache {{cache}} · {{pending}} pending · {{failed}} failed",
      ONLINE: "Online",
      OFFLINE: "Offline",
      ready: "ready",
      unavailable: "unavailable",
    },
    retry: "Rebase and retry",
    action: {
      retryFailed: "Queued changes could not be retried. Check your connection and try again.",
      discardFailed: "Local changes could not be discarded. Try again.",
      resetFailed: "The local cache could not be reset. Reload the app and try again.",
    },
    discard: {
      title: "Keep server changes",
      description: "Discard local Item changes and keep the current server version.",
      action: "Discard",
    },
    reset: {
      title: "Reset local cache",
      description: "Restart this browser's local Item cache.",
      action: "Reset cache",
    },
  },
  language: {
    title: "Language",
    description: "Choose the language and regional formatting used throughout the application.",
    ENGLISH: "English",
    CROATIAN: "Hrvatski",
  },
  theme: { title: "Dark mode", description: "Use the dark workspace palette throughout the application." },
  tableDensity: {
    title: "Table density",
    description: "Choose how much vertical space responsive data tables use.",
    COMPACT: "Compact",
    COMFORTABLE: "Comfortable",
  },
  pageWidth: {
    title: "Page content width",
    description: "Constrain content for readability or let it use all available space.",
    MEDIUM: "Medium",
    LARGE: "Large",
    EXTRA_LARGE: "Extra large",
    FULL: "No maximum",
  },
  desktopSurface: {
    title: "Desktop form surface",
    description: "Choose how responsive form overlays appear on desktop.",
    DIALOG: "Dialog",
    OVERLAY: "Overlay side panel",
    DOCKED: "Docked side panel",
  },
  resizablePanels: {
    title: "Resizable panels",
    description: "Allow pointer resizing for desktop side-panel form surfaces.",
  },
  lockNavigation: {
    title: "Lock navigation",
    description: "Prevent resizing while preserving the navigation's current expanded or compact mode.",
  },
  reset: {
    title: "Reset application preferences",
    description: "Restore every local presentation preference to its original value.",
    action: "Reset preferences",
  },
} as const;
export default en;
