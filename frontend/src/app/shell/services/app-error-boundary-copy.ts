import { APP_TRANSLATION_NAMESPACE } from "../../app.localization";
import { appI18n } from "../../ui/localization/app-i18n";
import en from "../../ui/localization/resources/app.en";

export const APP_ERROR_BOUNDARY_FALLBACK_COPY = en.errorBoundary;

type AppErrorBoundaryCopy = { [TKey in keyof typeof APP_ERROR_BOUNDARY_FALLBACK_COPY]: string };

export function resolveAppErrorBoundaryCopy(localizationReady = appI18n.isInitialized): AppErrorBoundaryCopy {
  if (!localizationReady) return APP_ERROR_BOUNDARY_FALLBACK_COPY;
  return {
    heading: appI18n.t("errorBoundary.heading", { ns: APP_TRANSLATION_NAMESPACE }),
    message: appI18n.t("errorBoundary.message", { ns: APP_TRANSLATION_NAMESPACE }),
    actions: appI18n.t("errorBoundary.actions", { ns: APP_TRANSLATION_NAMESPACE }),
    retry: appI18n.t("errorBoundary.retry", { ns: APP_TRANSLATION_NAMESPACE }),
    home: appI18n.t("errorBoundary.home", { ns: APP_TRANSLATION_NAMESPACE }),
    reload: appI18n.t("errorBoundary.reload", { ns: APP_TRANSLATION_NAMESPACE }),
    signOut: appI18n.t("errorBoundary.signOut", { ns: APP_TRANSLATION_NAMESPACE }),
  };
}
