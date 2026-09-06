import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ItemFormActions } from "../ItemFormActions/ItemFormActions";
import { useItemForm } from "../../../hooks/useItemForm";
import { DEFAULT_ITEM_FORM_VALIDATION_CONTEXT, type Item } from "../../../models/Item";
import { ItemFormFields } from "./ItemFormFields";

const submitted = fn();
const item: Item = {
  id: "77777777-7777-4777-8777-777777777777",
  version: 0,
  name: "Design system audit",
  description: "Review the application against current Vireo contracts.",
  quantity: 4,
  status: "ACTIVE",
};

function ItemFormFieldsFixture({ mode = AppFormMode.enum.UPDATE }: { mode?: AppFormMode }) {
  const form = useItemForm({
    initialValue: mode === AppFormMode.enum.CREATE ? undefined : item,
    mode,
    onSubmit: async value => {
      submitted(value);
    },
    validationContext: DEFAULT_ITEM_FORM_VALIDATION_CONTEXT,
  });

  return (
    <form.Form layoutWidth="standard" readOnly={mode === AppFormMode.enum.READ} readOnlyEmptyValue="Not provided">
      <ItemFormFields form={form} mode={mode} />
      <ItemFormActions editing={mode === AppFormMode.enum.UPDATE} form={form} onCancel={() => undefined} />
    </form.Form>
  );
}

const meta = {
  title: "FEATURES/Item/Item form fields",
  component: ItemFormFieldsFixture,
  parameters: { controls: { disable: true }, layout: "padded" },
} satisfies Meta<typeof ItemFormFieldsFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreatePresentation: Story = {
  args: { mode: AppFormMode.enum.CREATE },
};

export const ValidUpdate: Story = {
  args: { mode: AppFormMode.enum.UPDATE },
  beforeEach: () => {
    submitted.mockClear();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Updated item");
    await userEvent.click(canvas.getByRole("button", { name: "Save changes" }));
    await expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated item" }));
  },
};

export const ReadPresentation: Story = {
  args: { mode: AppFormMode.enum.READ },
};
