import { AppOfflineProvider } from "@/app/offline/providers/AppOfflineProvider";
import { patchOfflineSimulation, setConnectivityStatus } from "@/app/offline/actions/app-offline-actions";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { AppAuthContext } from "@/app/shell/contexts/AppAuthContext";
import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  eventSourceOptions: undefined as
    | {
        listeners: { heartbeat?: (event: MessageEvent<string>) => void };
        onOpen?: (event: Event) => void;
      }
    | undefined,
  initializeOfflineData: vi.fn().mockResolvedValue(undefined),
  recoverOfflineItems: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vireocodedev/ui/event-source", () => ({
  useVireoEventSource: vi.fn((options: NonNullable<typeof testState.eventSourceOptions>) => {
    testState.eventSourceOptions = options;
    return undefined;
  }),
}));

vi.mock("@/app/adapters/app-offline.adapter", () => ({
  hydrateOfflineItems: vi.fn().mockResolvedValue(undefined),
  initializeOfflineData: testState.initializeOfflineData,
  purgeOfflineData: vi.fn().mockResolvedValue(undefined),
  recoverOfflineItems: testState.recoverOfflineItems,
}));

vi.mock("@/app/adapters/app-offline.composition", () => ({
  initializeAppOfflineComposition: vi.fn(() => () => undefined),
}));

function heartbeat() {
  return new MessageEvent<string>("heartbeat", {
    data: JSON.stringify({ serverTime: new Date().toISOString(), syncInProgress: false }),
  });
}

describe("application offline provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.eventSourceOptions = undefined;
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
  });

  it("requests one recovery after the first heartbeat of every opened stream", async () => {
    render(
      <AppStorybookProvider>
        <AppAuthContext.Provider
          value={{
            user: { username: "admin", role: "SUPERADMIN" },
            loading: false,
            expireSession: vi.fn(),
            login: vi.fn().mockResolvedValue(undefined),
            logout: vi.fn().mockResolvedValue(undefined),
          }}
        >
          <AppOfflineProvider>content</AppOfflineProvider>
        </AppAuthContext.Provider>
      </AppStorybookProvider>,
    );
    await waitFor(() => expect(testState.eventSourceOptions).toBeDefined());
    const stream = testState.eventSourceOptions;
    if (!stream) throw new Error("Expected EventSource options.");

    act(() => stream.onOpen?.(new Event("open")));
    act(() => stream.listeners.heartbeat?.(heartbeat()));
    await waitFor(() => expect(testState.recoverOfflineItems).toHaveBeenCalledOnce());

    act(() => stream.listeners.heartbeat?.(heartbeat()));
    expect(testState.recoverOfflineItems).toHaveBeenCalledOnce();

    act(() => stream.onOpen?.(new Event("open")));
    act(() => stream.listeners.heartbeat?.(heartbeat()));
    await waitFor(() => expect(testState.recoverOfflineItems).toHaveBeenCalledTimes(2));
  });
});
