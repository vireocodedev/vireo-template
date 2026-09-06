import { describe, expect, it } from "vitest";
import { buildValidatedItemSchema, Item } from "@/features/item/models/Item";
import { appI18n } from "@/app/ui/localization/app-i18n";
import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";

const t = appI18n.getFixedT("en", "item");

function validatedSchema(mode: AppFormMode, nameMinimumLength = 2) {
  return buildValidatedItemSchema(t, { mode, nameMinimumLength });
}

describe("item contracts", () => {
  it("accepts a complete item form value", () => {
    expect(
      validatedSchema(AppFormMode.enum.CREATE).parse({
        id: "00000000-0000-4000-8000-000000000201",
        version: 0,
        name: "Design system audit",
        description: "Review Vireo usage.",
        quantity: 2,
        status: "ACTIVE",
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000201",
      version: 0,
      name: "Design system audit",
      description: "Review Vireo usage.",
      quantity: 2,
      status: "ACTIVE",
    });
  });

  it("rejects invalid quantities before an API request", () => {
    expect(() =>
      validatedSchema(AppFormMode.enum.UPDATE).parse({
        id: "00000000-0000-4000-8000-000000000202",
        version: 0,
        name: "Audit",
        description: "",
        quantity: -1,
        status: "DRAFT",
      }),
    ).toThrow();
  });

  it.each([AppFormMode.enum.CREATE, AppFormMode.enum.UPDATE])("applies editable name validation in %s mode", mode => {
    expect(() =>
      validatedSchema(mode).parse({
        id: "00000000-0000-4000-8000-000000000203",
        version: 0,
        name: "x",
        description: "",
        quantity: 0,
        status: "DRAFT",
      }),
    ).toThrow("Enter at least 2 characters.");
  });

  it("uses validation context parameters when constructing editable schemas", () => {
    expect(() =>
      validatedSchema(AppFormMode.enum.CREATE, 5).parse({
        id: "00000000-0000-4000-8000-000000000204",
        version: 0,
        name: "four",
        description: "",
        quantity: 0,
        status: "DRAFT",
      }),
    ).toThrow("Enter at least 5 characters.");
  });

  it("accepts structurally valid legacy names in READ mode", () => {
    expect(
      validatedSchema(AppFormMode.enum.READ, 20).parse({
        id: "00000000-0000-4000-8000-000000000205",
        version: 0,
        name: "x",
        description: "",
        quantity: 0,
        status: "DRAFT",
      }),
    ).toMatchObject({ name: "x" });
  });

  it("normalizes nullable API descriptions", () => {
    const item = Item.parse({
      id: "00000000-0000-4000-8000-000000000206",
      version: 0,
      name: "Audit",
      description: null,
      quantity: 0,
      status: "DRAFT",
    });
    expect(item.description).toBe("");
  });
});
