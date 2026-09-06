import { describe, expect, it, vi } from "vitest";
import { Item, ItemCreateRequest, ItemPatchRequest } from "@/features/item/models/Item";
import { ItemApiOnline } from "@/features/item/api/item.api.online";

describe("ItemApiOnline", () => {
  it("keeps frontend request validation aligned with the backend wire contract", () => {
    const create = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Valid Item",
      description: null,
      quantity: 0,
      status: "DRAFT" as const,
    };

    expect(ItemCreateRequest.safeParse(create).success).toBe(true);
    expect(
      ItemCreateRequest.safeParse({
        id: create.id,
        name: create.name,
        quantity: create.quantity,
        status: create.status,
      }).success,
    ).toBe(true);
    expect(ItemCreateRequest.safeParse({ ...create, name: "   " }).success).toBe(false);
    expect(ItemCreateRequest.safeParse({ ...create, name: "x".repeat(256) }).success).toBe(false);
    expect(ItemCreateRequest.safeParse({ ...create, description: "x".repeat(2001) }).success).toBe(false);
    expect(ItemCreateRequest.safeParse({ ...create, quantity: 2_147_483_648 }).success).toBe(false);
    expect(ItemPatchRequest.safeParse({ version: 0 }).success).toBe(false);
    expect(ItemPatchRequest.safeParse({ version: 0, name: "Changed" }).success).toBe(true);
    expect(ItemPatchRequest.safeParse({ version: 0, name: null }).success).toBe(false);
    expect(ItemPatchRequest.safeParse({ version: 0, description: null }).success).toBe(true);
    expect(ItemPatchRequest.safeParse({ version: 0, quantity: 2_147_483_648 }).success).toBe(false);
    expect(Item.parse({ ...create, version: 0 }).description).toBe("");
  });

  it("posts the client-generated UUID on create", async () => {
    const item = Item.parse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 0,
      name: "Offline-safe create",
      description: "",
      quantity: 1,
      status: "DRAFT",
    });
    const request = vi.fn().mockResolvedValue(item);
    const api = new ItemApiOnline() as unknown as {
      create: (value: typeof item) => Promise<{ persistence: "SAVED"; value: typeof item }>;
      httpPost: ReturnType<typeof vi.fn>;
    };
    api.httpPost = vi.fn(() => request);

    const result = await api.create(item);

    expect(request).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ id: item.id, name: item.name, quantity: item.quantity, status: item.status }),
    );
    expect(request).not.toHaveBeenCalledWith("", expect.objectContaining({ version: expect.anything() }));
    expect(result).toEqual({ persistence: "SAVED", value: item });
  });

  it("patches the path Item without placing its ID in the body", async () => {
    const item = Item.parse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 3,
      name: "Patch proof",
      description: "",
      quantity: 4,
      status: "ACTIVE",
    });
    const request = vi.fn().mockResolvedValue({ ...item, version: 4 });
    const api = new ItemApiOnline() as unknown as {
      update: (id: string, value: typeof item) => Promise<{ persistence: "SAVED"; value: typeof item }>;
      httpPatch: ReturnType<typeof vi.fn>;
    };
    api.httpPatch = vi.fn(() => request);

    await api.update(item.id, item);

    expect(request).toHaveBeenCalledWith(item.id, expect.objectContaining({ version: 3, name: item.name }));
    expect(request.mock.calls[0]?.[1]).not.toHaveProperty("id");
  });
});
