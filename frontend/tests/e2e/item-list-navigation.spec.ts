import { expect, test } from "@playwright/test";
import { authenticateAsDevelopmentAdministrator } from "./support/authentication";

const activeFilter = {
  entity: "ITEM",
  rows: [
    {
      kind: "leaf",
      path: "status",
      operator: "EQUALS",
      value: "ACTIVE",
      parameterized: false,
      selectedOptions: [],
    },
  ],
};

test("an Item-list deep link survives reload and browser history", async ({ page }) => {
  await authenticateAsDevelopmentAdministrator(page);
  const params = new URLSearchParams({
    q: "Portable",
    size: "20",
    sort: "quantity",
    direction: "desc",
    filters: `1:${JSON.stringify(activeFilter)}`,
  });
  await page.goto(`/items?${params.toString()}`);

  const search = page.getByRole("textbox", { name: "Search by name, description or status" });
  await expect(search).toHaveValue("Portable");
  await expect(page.getByRole("button", { name: "Filters (1)" }).first()).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue("Portable");
  await expect(page.getByRole("button", { name: "Filters (1)" }).first()).toBeVisible();

  await search.fill("Thermal");
  await search.press("Enter");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Thermal");

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Portable");
  await expect(search).toHaveValue("Portable");
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Thermal");
  await expect(search).toHaveValue("Thermal");

  if ((page.viewportSize()?.width ?? 0) < 900) {
    await page.getByRole("navigation", { name: "Quick navigation" }).getByRole("button", { name: "Items" }).click();
  } else {
    await page.getByRole("link", { name: "Items" }).click();
  }
  await expect(page).toHaveURL(/\/items$/u);
  await expect(search).toHaveValue("");

  await page.goto("/items?q=Portable&page=1");
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("1");
  await page.reload();
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("1");
});
