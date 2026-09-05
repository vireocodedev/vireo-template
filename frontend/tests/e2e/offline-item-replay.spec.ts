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
  if (projectName === "mobile-chromium") await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("button", { name: "Open offline settings" })).toContainText(label);
  if (projectName === "mobile-chromium") {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Close navigation" })).not.toBeVisible();
  }
}

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
  await authenticateAsDevelopmentAdministrator(page);
  await page.goto("/items");
  await expectConnectivity(page, testInfo.project.name, "Online");

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
    sigOfflineSimulation.value = { ...sigOfflineSimulation.value, enabled: false };
  });

  await hydrationStarted.promise;
  await expectConnectivity(page, testInfo.project.name, "Online");
  releaseHydration.resolve();
  await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();
});
