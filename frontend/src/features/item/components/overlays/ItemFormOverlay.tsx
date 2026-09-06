import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";
import { VireoResponsiveFormOverlay } from "@vireocodedev/ui";
import { ItemFormActions } from "../forms/ItemFormActions/ItemFormActions";
import { ItemFormFields } from "../forms/ItemFormFields/ItemFormFields";
import { useItemCreateMutation } from "../../hooks/useItemCreateMutation";
import { useItemUpdateMutation } from "../../hooks/useItemUpdateMutation";
import { useItemForm } from "../../hooks/useItemForm";
import { DEFAULT_ITEM_FORM_VALIDATION_CONTEXT, type Item } from "../../models/Item";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { sigOfflineRecoveryInProgress } from "@/app/offline/signals/sigOfflineRecoveryInProgress";
import { useItemTranslation } from "../../localization/use-item-translation";

export type ItemFormOverlayProps = {
  item?: Item;
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
};

function getItemFormMode(item: Item | undefined): AppFormMode {
  return item ? AppFormMode.enum.UPDATE : AppFormMode.enum.CREATE;
}

export function ItemFormOverlay({ item, open, onClose, onExited }: ItemFormOverlayProps) {
  const { t } = useItemTranslation();
  const createItem = useItemCreateMutation();
  const updateItem = useItemUpdateMutation();
  const preferences = sigAppPreferences.value;
  const recoveryInProgress = sigOfflineRecoveryInProgress.value;
  const mode = getItemFormMode(item);
  const submit = async (value: Item) => {
    if (item) {
      await updateItem.mutateAsync({ id: item.id, value });
    } else {
      await createItem.mutateAsync(value);
    }
    onClose();
  };
  const form = useItemForm({
    initialValue: item,
    mode,
    onSubmit: submit,
    validationContext: DEFAULT_ITEM_FORM_VALIDATION_CONTEXT,
  });
  const savePending = createItem.isPending || updateItem.isPending;

  return (
    <VireoResponsiveFormOverlay
      open={open}
      onClose={onClose}
      onExited={onExited}
      closeDisabled={savePending}
      title={item ? t("form.updateTitle") : t("form.createTitle")}
      closeLabel={t("form.close")}
      desktopSurface={preferences.desktopSurface}
      allowSidePanelResize={preferences.allowSidePanelResize}
      desktopNavWidth={preferences.navigationMode === "compact" ? 80 : preferences.navigationWidth}
      desktopSidePanelWidth={560}
      maxWidth="md"
      renderForm={children => (
        <form.Form
          layoutWidth="full"
          readOnly={mode === AppFormMode.enum.READ}
          readOnlyEmptyValue={t("form.notProvided")}
          unsavedChangesGuard
        >
          {children}
        </form.Form>
      )}
      actions={({ requestClose }) => (
        <ItemFormActions
          form={form}
          editing={mode === AppFormMode.enum.UPDATE}
          onCancel={requestClose}
          pending={savePending}
          submissionDisabled={recoveryInProgress}
        />
      )}
    >
      <ItemFormFields form={form} mode={mode} />
    </VireoResponsiveFormOverlay>
  );
}
