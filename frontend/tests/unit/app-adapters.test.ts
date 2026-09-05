import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAdapterSlot } from "@/app/adapters/createAdapterSlot";
import { createMockAppAdapters } from "@/app/adapters/mock/app.mock-adapters";

describe("application adapter composition", () => {
  it("keeps a stable reference while replacing and resetting the implementation", () => {
    const original = {
      value: 1,
      read() {
        return this.value;
      },
    };
    const replacement = {
      value: 2,
      read() {
        return this.value;
      },
    };
    const slot = createAdapterSlot(original);

    expect(slot.adapter.read()).toBe(1);
    slot.configure(replacement);
    expect(slot.adapter.read()).toBe(2);
    slot.reset();
    expect(slot.adapter.read()).toBe(1);
  });

  it("provides a backend-independent mock CRUD and authentication path", async () => {
    const adapters = createMockAppAdapters();
    await expect(adapters.auth.me()).rejects.toMatchObject({ failure: { kind: "unauthenticated" } });
    await adapters.auth.login("demo", "demo123");
    await expect(adapters.auth.me()).resolves.toEqual({ username: "demo", role: "SUPERADMIN" });

    const page = await adapters.items.search(
      { page: 0, rowsPerPage: 10, sortBy: "name", sortDirection: "asc" },
      { searchText: "backend", queryFilters: null },
    );
    expect(page.totalElements).toBe(1);

    const created = await adapters.items.create({
      id: "00000000-0000-4000-8000-000000000121",
      version: 0,
      name: "Frontend-owned adapter",
      description: "Company API boundary",
      quantity: 2,
      status: "DRAFT",
    });
    expect(created).toMatchObject({ persistence: "SAVED" });
    expect(created.value.id).toMatch(/^00000000|^[0-9a-f]{8}-/u);
    await expect(adapters.history.find(z.any() as never, "ITEM", created.value.id)).resolves.toEqual([]);
  });
});
