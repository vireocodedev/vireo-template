import { APP_TRANSLATION_NAMESPACE } from "@/app/app.localization";
import { appI18n } from "@/app/ui/localization/app-i18n";

export const APP_ERROR_BOUNDARY_FALLBACK_COPY = {
  heading: "Something went wrong",
  message: "This page could not be displayed. Try again, or use one of the recovery actions below.",
  actions: "Application recovery actions",
  retry: "Try again",
  home: "Go home",
  reload: "Reload application",
  signOut: "Sign out",
} as const;

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
