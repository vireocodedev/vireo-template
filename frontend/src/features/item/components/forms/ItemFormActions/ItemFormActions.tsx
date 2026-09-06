import { Button } from "@mui/material";
import { usePlatformTranslation } from "@vireocodedev/ui/react-i18next";
import { type ItemFormApi } from "../../../hooks/useItemForm";
import { useItemTranslation } from "../../../localization/use-item-translation";

export type ItemFormActionsProps = {
  editing: boolean;
  form: ItemFormApi;
  onCancel: () => void;
  pending?: boolean;
  submissionDisabled?: boolean;
};

export function ItemFormActions({
  editing,
  form,
  onCancel,
  pending = false,
  submissionDisabled = false,
}: ItemFormActionsProps) {
  const { t } = usePlatformTranslation();
  const { t: tItem } = useItemTranslation();

  return (
    <form.Actions>
      <Button disabled={pending} onClick={onCancel}>
        {t("common.cancel")}
      </Button>
      <form.SubmitButton disabled={pending || submissionDisabled} variant="contained">
        {editing ? tItem("form.update") : tItem("form.create")}
      </form.SubmitButton>
    </form.Actions>
  );
}
