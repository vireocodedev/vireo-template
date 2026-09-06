import { ItemMutationKeys } from "../api/item.query";
import { useMutationState } from "@tanstack/react-query";

export function usePendingItemUpdateId(): string | null {
  const ids = useMutationState<string>({
    filters: { mutationKey: ItemMutationKeys.update, status: "pending" },
    select: mutation => {
      const variables = mutation.state.variables as { id?: unknown } | undefined;
      return typeof variables?.id === "string" ? variables.id : "";
    },
  });
  return ids.filter(Boolean).at(-1) ?? null;
}
