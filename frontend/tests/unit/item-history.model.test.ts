import { createItemHistoryDefinition, ItemHistoryRecordSchema } from "@/features/item/models/ItemHistory";
import { appI18n } from "@/app/ui/localization/app-i18n";
import { createHistoryNodes } from "@vireocodedev/history";
import { describe, expect, it } from "vitest";

describe("Item history contracts", () => {
  it("validates the current actor record shape and produces typed Item changes", () => {
    const record = ItemHistoryRecordSchema.parse({
      id: "3d16bc25-0fde-44a6-91fd-e84a3f64323d",
      timestamp: "2026-08-24T18:30:00Z",
      actor: { id: "admin", label: "admin" },
      entity: "ITEM",
      entityId: "00000000-0000-4000-8000-000000000401",
      snapshotPrevious: {
        id: "00000000-0000-4000-8000-000000000401",
        version: 0,
        name: "Starter audit",
        description: null,
        quantity: 1,
        status: "DRAFT",
      },
      snapshotCurrent: {
        id: "00000000-0000-4000-8000-000000000401",
        version: 0,
        name: "Starter audit",
        description: "History enabled",
        quantity: 2,
        status: "ACTIVE",
      },
    });

    expect(record.snapshotPrevious?.description).toBe("");
    const definition = createItemHistoryDefinition(appI18n.getFixedT("en", "item"), "en");
    expect(createHistoryNodes(definition, record.snapshotPrevious, record.snapshotCurrent)).not.toEqual([]);
  });

  it("rejects records belonging to another entity kind", () => {
    expect(() =>
      ItemHistoryRecordSchema.parse({
        id: "history-1",
        timestamp: "2026-08-24T18:30:00Z",
        actor: null,
        entity: "BUYER",
        entityId: "42",
        snapshotPrevious: null,
        snapshotCurrent: null,
      }),
    ).toThrow();
  });
});
