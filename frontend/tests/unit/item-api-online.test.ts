import { describe, expect, it, vi } from "vitest";
import { Item } from "@/features/item/models/Item";
import { ItemApiOnline } from "@/features/item/api/item.api.online";

describe("ItemApiOnline", () => {
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

    expect(request).toHaveBeenCalledWith("", expect.objectContaining({ id: item.id, version: 0 }));
    expect(result).toEqual({ persistence: "SAVED", value: item });
  });
});
