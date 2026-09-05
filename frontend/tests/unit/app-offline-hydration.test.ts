import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOfflineHydration, runOfflineRecovery } from "@/app/offline/services/app-offline-hydration";
import { sigOfflineRecoveryInProgress } from "@/app/offline/signals/sigOfflineRecoveryInProgress";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("offline hydration coordinator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("folds replay-period batches into the final recovery hydration", async () => {
    const hydrate = vi.fn().mockResolvedValue(undefined);

    await runOfflineRecovery(async () => {
      await requestOfflineHydration(hydrate);
      await requestOfflineHydration(hydrate);
    }, hydrate);

    expect(hydrate).toHaveBeenCalledOnce();
  });

  it("runs one trailing hydration for a batch received during the final fetch", async () => {
    const hydrate = vi.fn(async () => {
      if (hydrate.mock.calls.length === 1) await requestOfflineHydration(hydrate);
    });

    await runOfflineRecovery(async () => undefined, hydrate);

    expect(hydrate).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent automatic recovery and preserves a trailing hydration", async () => {
    const firstWork = deferred();
    const hydrate = vi.fn().mockResolvedValue(undefined);
    const secondWork = vi.fn().mockResolvedValue(undefined);

    const firstRecovery = runOfflineRecovery(() => firstWork.promise, hydrate);
    const secondRecovery = runOfflineRecovery(secondWork, hydrate);
    await Promise.resolve();

    expect(secondWork).not.toHaveBeenCalled();
    firstWork.resolve();
    await Promise.all([firstRecovery, secondRecovery]);

    expect(secondWork).not.toHaveBeenCalled();
    expect(hydrate).toHaveBeenCalledTimes(2);
  });

  it("serializes manual recovery after automatic recovery", async () => {
    const firstWork = deferred();
    const hydrate = vi.fn().mockResolvedValue(undefined);
    const manualWork = vi.fn().mockResolvedValue(undefined);

    const automaticRecovery = runOfflineRecovery(() => firstWork.promise, hydrate);
    const manualRecovery = runOfflineRecovery(manualWork, hydrate, "manual");
    await Promise.resolve();

    expect(manualWork).not.toHaveBeenCalled();
    firstWork.resolve();
    await Promise.all([automaticRecovery, manualRecovery]);

    expect(manualWork).toHaveBeenCalledOnce();
  });

  it("holds one origin-wide lock across replay and hydration", async () => {
    const order: string[] = [];
    vi.stubGlobal("navigator", {
      locks: {
        request: vi.fn(async (_name: string, operation: () => Promise<void>) => {
          order.push("lock:start");
          await operation();
          order.push("lock:end");
        }),
      },
    });

    await runOfflineRecovery(
      async () => {
        order.push("replay");
      },
      async () => {
        order.push("hydrate");
      },
    );

    expect(order).toEqual(["lock:start", "replay", "hydrate", "lock:end"]);
  });

  it("exposes recovery as busy until replay and hydration finish", async () => {
    const replay = deferred();
    const recovery = runOfflineRecovery(
      () => replay.promise,
      async () => undefined,
    );

    await vi.waitFor(() => expect(sigOfflineRecoveryInProgress.value).toBe(true));
    replay.resolve();
    await recovery;

    expect(sigOfflineRecoveryInProgress.value).toBe(false);
  });
});
