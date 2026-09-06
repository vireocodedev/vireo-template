import { expect, test } from "@playwright/test";

const username = process.env.VIREO_DEPLOYMENT_SMOKE_USERNAME!;
const password = process.env.VIREO_DEPLOYMENT_SMOKE_PASSWORD!;

test("the built production stack persists an authenticated item mutation", async ({ page }) => {
  const itemName = `Deployment smoke ${Date.now()}`;

  const loginResponse = await page.goto("/login");
  expect(loginResponse?.ok()).toBe(true);
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/u);

  await page.goto("/items");
  await page.getByRole("button", { name: "Create item" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(itemName);
  await page.getByRole("textbox", { name: "Quantity" }).fill("7");
  await page.getByRole("button", { name: "Create item" }).last().click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();
});

test("the built production stack incrementally delivers authenticated heartbeat events", async ({ page }) => {
  const loginResponse = await page.goto("/login");
  expect(loginResponse?.ok()).toBe(true);
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/u);

  const heartbeatEvents = await page.evaluate(
    () =>
      new Promise<Array<{ payload: unknown; receivedAt: number }>>((resolve, reject) => {
        const stream = new EventSource("/api/offline/heartbeat/stream");
        const timeout = window.setTimeout(() => {
          stream.close();
          reject(new Error("Timed out waiting for three heartbeat events through the frontend origin."));
        }, 20_000);
        const received: Array<{ payload: unknown; receivedAt: number }> = [];

        stream.addEventListener("heartbeat", event => {
          received.push({ payload: JSON.parse(event.data), receivedAt: performance.now() });
          if (received.length === 3) {
            window.clearTimeout(timeout);
            stream.close();
            resolve(received);
          }
        });
        stream.addEventListener("error", () => {
          window.clearTimeout(timeout);
          stream.close();
          reject(new Error("Authenticated heartbeat stream failed before three events arrived."));
        });
      }),
  );

  expect(heartbeatEvents).toHaveLength(3);
  for (const heartbeat of heartbeatEvents) {
    expect(heartbeat.payload).toEqual({
      serverTime: expect.any(String),
      syncInProgress: expect.any(Boolean),
    });
    expect(Number.isNaN(Date.parse((heartbeat.payload as { serverTime: string }).serverTime))).toBe(false);
  }
  expect(heartbeatEvents[2].receivedAt - heartbeatEvents[1].receivedAt).toBeGreaterThanOrEqual(2_500);
});
