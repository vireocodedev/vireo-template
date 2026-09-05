import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initSignalEffects } from "@/app/init-signal-effects";
import { patchSyncSummary } from "@/app/offline/actions/app-offline-actions";
import { DEFAULT_SYNC_SUMMARY } from "@/app/offline/models/AppOffline";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { appI18n } from "@/app/ui/localization/app-i18n";

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));

vi.mock("@vireocodedev/ui/sonner", () => ({ toast: toastMocks }));

describe("application signal effects", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sigSyncSummary.value = DEFAULT_SYNC_SUMMARY;
    sigConnectivityStatus.value = ConnectivityStatus.ONLINE;
    await appI18n.changeLanguage("en");
    initSignalEffects();
  });

  it("announces one aggregate message after queued changes synchronize", () => {
    act(() => {
      patchSyncSummary({ lastSynchronizedCount: 3, synchronizationSequence: 1 });
    });

    expect(toastMocks.success).toHaveBeenCalledWith("3 queued changes synchronized.");
  });

  it("localizes connectivity transitions in the active language", async () => {
    act(() => {
      sigConnectivityStatus.value = ConnectivityStatus.OFFLINE;
    });
    expect(toastMocks.warning).toHaveBeenCalledWith("Working offline.", { id: "app-connectivity-transition" });

    await appI18n.changeLanguage("hr");
    act(() => {
      sigConnectivityStatus.value = ConnectivityStatus.ONLINE;
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Veza je ponovno uspostavljena.", {
      id: "app-connectivity-transition",
    });
  });
});
