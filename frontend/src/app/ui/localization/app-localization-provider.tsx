import React, { type PropsWithChildren } from "react";
import dayjs from "dayjs";
import "dayjs/locale/hr";
import utc from "dayjs/plugin/utc";
import { I18nextProvider } from "react-i18next";
import { VireoTemporalLocalizationProvider } from "@vireocodedev/ui/localization";
import { appI18n } from "@/app/ui/localization/app-i18n";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";

// Keep the public 0.2.x Template robust even when a consumer bundler drops the
// UI package's setup-only module. Day.js plugin registration is idempotent.
dayjs.extend(utc);

export function AppLocalizationProvider({ children }: PropsWithChildren) {
  const { locale } = sigAppPreferences.value;

  React.useEffect(() => {
    document.documentElement.lang = locale;

    if (appI18n.resolvedLanguage !== locale) {
      void appI18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <I18nextProvider i18n={appI18n}>
      <VireoTemporalLocalizationProvider locale={locale}>{children}</VireoTemporalLocalizationProvider>
    </I18nextProvider>
  );
}
