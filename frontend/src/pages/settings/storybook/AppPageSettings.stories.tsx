import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { AppPageSettings } from "../AppPageSettings";

const neverSettles = () => new Promise<void>(() => undefined);

const meta = {
  title: "PAGES/Settings",
  component: AppPageSettings,
  parameters: {
    controls: { disable: true },
    vireo: { loading: { categories: ["busy-action"], geometry: "A" } },
  },
} satisfies Meta<typeof AppPageSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OfflineMaintenancePending: Story = {
  args: {
    offlineOperations: { discard: neverSettles, reset: neverSettles, retry: neverSettles },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const reset = canvas.getByRole("button", { name: "Reset cache" });
    await userEvent.click(reset);
    await expect(reset).toBeDisabled();
    await expect(reset).toHaveAttribute("aria-busy", "true");
  },
};

export const OfflineMaintenanceError: Story = {
  args: {
    offlineOperations: {
      discard: neverSettles,
      reset: () => Promise.reject(new Error("Storage unavailable")),
      retry: neverSettles,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reset cache" }));
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("The local cache could not be reset. Reload the app and try again.");
    await expect(alert).not.toHaveTextContent("Storage unavailable");
  },
};
