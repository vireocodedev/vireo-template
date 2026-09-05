import { expect, test } from "@playwright/test";
import { authenticateAsDevelopmentAdministrator } from "./support/authentication";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function expectConnectivity(
  page: import("@playwright/test").Page,
  projectName: string,
  label: "Online" | "Offline",
) {
  if (projectName === "mobile-chromium") {
    await page.getByRole("button", { name: "Open navigation" }).focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByRole("button", { name: "Open offline settings" })).toContainText(label);
  if (projectName === "mobile-chromium") {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Close navigation" })).not.toBeVisible();
  }
}

test("serializes offline recovery across two tabs", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One Chromium lane proves the origin-wide Web Lock.");
  await authenticateAsDevelopmentAdministrator(page);
  const secondPage = await context.newPage();
  await secondPage.goto("/items");
  await expect(secondPage.getByRole("heading", { name: "Items" })).toBeVisible();

  const suffix = crypto.randomUUID();
  const keys = {
    firstState: `offline-lock:first:${suffix}`,
    releaseFirst: `offline-lock:release:${suffix}`,
    secondObserved: `offline-lock:second:${suffix}`,
    secondFinished: `offline-lock:finished:${suffix}`,
  };
  await page.evaluate(async lockKeys => {
    const recoveryUrl = "/src/app/offline/services/app-offline-hydration.ts";
    const { runOfflineRecovery } = await import(/* @vite-ignore */ recoveryUrl);
    void runOfflineRecovery(
      async () => {
        localStorage.setItem(lockKeys.firstState, "working");
        await new Promise<void>(resolve => {
          const waitForRelease = () => {
            if (localStorage.getItem(lockKeys.releaseFirst) === "yes") resolve();
            else window.setTimeout(waitForRelease, 10);
          };
          waitForRelease();
        });
        localStorage.setItem(lockKeys.firstState, "done");
      },
      async () => undefined,
      "manual",
    );
  }, keys);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), keys.firstState)).toBe("working");

  const observedBeforeRelease = await secondPage.evaluate(async lockKeys => {
    const recoveryUrl = "/src/app/offline/services/app-offline-hydration.ts";
    const { runOfflineRecovery } = await import(/* @vite-ignore */ recoveryUrl);
    void runOfflineRecovery(
      async () => {
        localStorage.setItem(lockKeys.secondObserved, localStorage.getItem(lockKeys.firstState) ?? "missing");
      },
      async () => undefined,
      "manual",
    ).then(() => localStorage.setItem(lockKeys.secondFinished, "yes"));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return localStorage.getItem(lockKeys.secondObserved);
  }, keys);
  expect(observedBeforeRelease).toBeNull();

  await secondPage.evaluate(key => localStorage.setItem(key, "yes"), keys.releaseFirst);
  await expect.poll(() => secondPage.evaluate(key => localStorage.getItem(key), keys.secondFinished)).toBe("yes");
  expect(await secondPage.evaluate(key => localStorage.getItem(key), keys.secondObserved)).toBe("done");
});

test("offline Item changes survive reload and replay in order", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const createdName = `Offline ${suffix}`;
  const updatedName = `Replayed ${suffix}`;
  const deletedName = `Deleted ${suffix}`;
  await authenticateAsDevelopmentAdministrator(page);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        crossOriginIsolated: globalThis.crossOriginIsolated,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      })),
    )
    .toEqual({ crossOriginIsolated: true, hasSharedArrayBuffer: true });
  await expectConnectivity(page, testInfo.project.name, "Online");

  await page.goto("/settings#offline");
  await page.getByRole("switch", { name: "Offline simulator" }).check();
  await expectConnectivity(page, testInfo.project.name, "Offline");

  await page.goto("/items");
  await page.getByRole("button", { name: "Create item" }).first().click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(createdName);
  await page.getByRole("textbox", { name: "Quantity" }).fill("4");
  await page.getByRole("button", { name: "Create item" }).last().click();
  await expect(page.getByText(`${createdName} queued for synchronization`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(createdName, { exact: true })).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search by name, description or status" });
  await search.fill(createdName);
  await search.press("Enter");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button").filter({ hasText: createdName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
  } else {
    await page.getByRole("row").filter({ hasText: createdName }).getByRole("button", { name: "Edit" }).click();
  }
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(updatedName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`${updatedName} queued for synchronization`)).toBeVisible();
  await search.fill(updatedName);
  await search.press("Enter");
  await expect(page.getByText(updatedName, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Create item" }).first().click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(deletedName);
  await page.getByRole("textbox", { name: "Quantity" }).fill("1");
  await page.getByRole("button", { name: "Create item" }).last().click();
  await search.fill(deletedName);
  await search.press("Enter");
  await expect(page.getByText(deletedName, { exact: true }).first()).toBeVisible();
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button").filter({ hasText: deletedName }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
  } else {
    await page
      .getByRole("row")
      .filter({ hasText: deletedName })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(`${deletedName} queued for synchronization`)).toBeVisible();
  await expect(page.getByText("No items match the current search and filters.")).toBeVisible();

  await page.goto("/settings#offline");
  await page.getByRole("switch", { name: "Offline simulator" }).uncheck();
  await expectConnectivity(page, testInfo.project.name, "Online");
  await expect(page.getByText("4 queued changes synchronized.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/0 pending · 0 failed/u)).toBeVisible({ timeout: 30_000 });

  await page.goto("/items");
  await search.fill(updatedName);
  await search.press("Enter");
  await expect(page.getByText(updatedName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pending", { exact: true })).not.toBeVisible();

  await search.fill(deletedName);
  await search.press("Enter");
  await expect(page.getByText("No items match the current search and filters.")).toBeVisible();
});

test("an open Item draft survives recovery while submission is disabled", async ({ page }) => {
  test.setTimeout(90_000);
  await authenticateAsDevelopmentAdministrator(page);
  await page.goto("/items");
  await page.getByRole("button", { name: "Create item" }).first().click();
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  const save = page.getByRole("button", { name: "Create item" }).last();
  await name.fill("Draft preserved across recovery");

  await page.evaluate(async () => {
    const actionsUrl = "/src/app/offline/actions/app-offline-actions.ts";
    const { patchOfflineSimulation } = await import(/* @vite-ignore */ actionsUrl);
    patchOfflineSimulation({ enabled: true });
  });
  await expect(page.getByText("Working offline.")).toBeVisible({ timeout: 20_000 });

  const hydrationStarted = deferred();
  const releaseHydration = deferred();
  let delayedHydration = false;
  await page.route("**/api/items/search*", async route => {
    if (delayedHydration || route.request().method() !== "POST") return route.continue();
    delayedHydration = true;
    hydrationStarted.resolve();
    await releaseHydration.promise;
    await route.continue();
  });
  await page.evaluate(async () => {
    const actionsUrl = "/src/app/offline/actions/app-offline-actions.ts";
    const { patchOfflineSimulation } = await import(/* @vite-ignore */ actionsUrl);
    patchOfflineSimulation({ enabled: false });
  });

  await hydrationStarted.promise;
  await expect(save).toBeDisabled();
  await expect(name).toHaveValue("Draft preserved across recovery");

  releaseHydration.resolve();
  await expect(save).toBeEnabled();
  await expect(name).toHaveValue("Draft preserved across recovery");
});

test("a short SSE reconnect repairs data without an offline status transition", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const missedItemName = `AAA missed during reconnect ${testInfo.project.name}-${Date.now()}`;
  await authenticateAsDevelopmentAdministrator(page);
  await page.goto("/items");
  await expectConnectivity(page, testInfo.project.name, "Online");
  await page.evaluate(
    () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const recoverySignalUrl = "/src/app/offline/signals/sigOfflineRecoveryInProgress.ts";
        const cacheSignalUrl = "/src/app/offline/signals/sigCacheReadiness.ts";
        const { sigOfflineRecoveryInProgress } = await import(/* @vite-ignore */ recoverySignalUrl);
        const { sigCacheReadiness } = await import(/* @vite-ignore */ cacheSignalUrl);
        return { cache: sigCacheReadiness.value.status, recovery: sigOfflineRecoveryInProgress.value };
      }),
    )
    .toEqual({ cache: "READY", recovery: false });

  const hydrationStarted = deferred();
  const releaseHydration = deferred();
  let delayedHydration = false;
  await page.route("**/api/items/search*", async route => {
    if (delayedHydration || route.request().method() !== "POST") return route.continue();
    delayedHydration = true;
    hydrationStarted.resolve();
    await releaseHydration.promise;
    await route.continue();
  });

  await page.evaluate(async () => {
    const signalUrl = "/src/app/offline/signals/sigOfflineSimulation.ts";
    const { sigOfflineSimulation } = await import(/* @vite-ignore */ signalUrl);
    sigOfflineSimulation.value = { ...sigOfflineSimulation.value, enabled: true };
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const created = await page.evaluate(async name => {
    const csrfToken = document.cookie
      .split("; ")
      .find(cookie => cookie.startsWith("XSRF-TOKEN="))
      ?.slice("XSRF-TOKEN=".length);
    const response = await fetch("/api/items", {
      body: JSON.stringify({
        id: crypto.randomUUID(),
        version: 0,
        name,
        description: "Created while the realtime stream was unavailable.",
        quantity: 1,
        status: "ACTIVE",
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": decodeURIComponent(csrfToken ?? "") },
      method: "POST",
    });
    return { body: await response.text(), ok: response.ok };
  }, missedItemName);
  expect(created.ok, created.body).toBe(true);
  await page.evaluate(async () => {
    const signalUrl = "/src/app/offline/signals/sigOfflineSimulation.ts";
    const { sigOfflineSimulation } = await import(/* @vite-ignore */ signalUrl);
    sigOfflineSimulation.value = { ...sigOfflineSimulation.value, enabled: false };
  });

  await hydrationStarted.promise;
  await expectConnectivity(page, testInfo.project.name, "Online");
  await expect(page.getByText(missedItemName, { exact: true })).not.toBeVisible();
  releaseHydration.resolve();
  await expect(page.getByText(missedItemName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
});

test("a rejected offline deletion returns as an actionable conflict", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const id = crypto.randomUUID();
  const name = `Delete conflict ${testInfo.project.name}-${Date.now()}`;
  const item = { id, version: 0, name, description: "Original server value", quantity: 1, status: "ACTIVE" };
  await authenticateAsDevelopmentAdministrator(page);
  const created = await page.evaluate(async value => {
    const csrfToken = document.cookie
      .split("; ")
      .find(cookie => cookie.startsWith("XSRF-TOKEN="))
      ?.slice("XSRF-TOKEN=".length);
    const response = await fetch("/api/items", {
      body: JSON.stringify(value),
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": decodeURIComponent(csrfToken ?? "") },
      method: "POST",
    });
    return { body: await response.text(), ok: response.ok, status: response.status };
  }, item);
  expect(created.ok, created.body).toBe(true);

  await page.goto("/settings#offline");
  await page.getByRole("switch", { name: "Offline simulator" }).check();
  await expectConnectivity(page, testInfo.project.name, "Offline");
  await page.goto("/items");
  const search = page.getByRole("textbox", { name: "Search by name, description or status" });
  await search.fill(name);
  await search.press("Enter");
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button").filter({ hasText: name }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
  } else {
    await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Delete", exact: true }).click();
  }
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No items match the current search and filters.")).toBeVisible();

  const changed = await page.evaluate(
    async value => {
      const csrfToken = document.cookie
        .split("; ")
        .find(cookie => cookie.startsWith("XSRF-TOKEN="))
        ?.slice("XSRF-TOKEN=".length);
      const response = await fetch(`/api/items/${value.id}`, {
        body: JSON.stringify(value),
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": decodeURIComponent(csrfToken ?? "") },
        method: "PUT",
      });
      return { body: await response.text(), ok: response.ok, status: response.status };
    },
    { ...item, description: "Changed on the server while deletion was queued" },
  );
  expect(changed.ok, changed.body).toBe(true);
  await page.goto("/settings#offline");
  await page.getByRole("switch", { name: "Offline simulator" }).uncheck();
  await expect(page.getByText(/0 pending · 1 failed/u)).toBeVisible({ timeout: 30_000 });

  await page.goto("/items");
  await search.fill(name);
  await search.press("Enter");
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Conflict", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Conflict", { exact: true })).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button").filter({ hasText: name }).click();
  }
  await page.getByRole("button", { name: `Resolve sync conflict for ${name}` }).click();
  await expect(page).toHaveURL(/\/settings#offline$/u);
  const discard = testInfo.project.name === "mobile-chromium";
  await page.getByRole("button", { name: discard ? "Discard" : "Rebase and retry", exact: true }).click();
  await expect(page.getByText(/0 pending · 0 failed/u)).toBeVisible({ timeout: 30_000 });

  await page.goto(`/items?q=${encodeURIComponent(name)}`);
  if (discard) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  else await expect(page.getByText("No items match the current search and filters.")).toBeVisible();
});
