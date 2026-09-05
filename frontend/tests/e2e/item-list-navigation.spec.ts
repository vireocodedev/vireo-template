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
  await expect(page.getByText("Portable barcode scanners", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Filters (1)" }).first()).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue("Portable");
  await expect(page.getByRole("button", { name: "Filters (1)" }).first()).toBeVisible();

  await search.fill("Thermal");
  await search.press("Enter");
  await expect(page.getByText("Thermal label rolls", { exact: true }).first()).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Thermal");

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Portable");
  await expect(search).toHaveValue("Portable");
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("Thermal");
  await expect(search).toHaveValue("Thermal");

  await page.goto("/items?q=Portable&page=1");
  await expect(page.getByText("No items match the current search and filters.")).toBeVisible();
  await page.reload();
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("1");
  await expect(page.getByText("No items match the current search and filters.")).toBeVisible();
});
