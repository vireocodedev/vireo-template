import type { WidenLeaves } from "@vireocodedev/localization";
import type en from "./app.en";

const hr = {
  offline: {
    ONLINE: "Na mreži",
    OFFLINE: "Izvan mreže",
    SYNCING: "Sinkronizacija",
    PENDING: "{{count}} na čekanju",
    FAILED: "{{count}} neuspjelo",
    OPEN_SETTINGS_WITH_STATUS: "{{status}}. Otvori izvanmrežne postavke",
    CONNECTION_RESTORED: "Veza je ponovno uspostavljena.",
    WORKING_OFFLINE: "Rad izvan mreže.",
  },
  navigation: {
    PRIMARY: "Glavna navigacija",
    OVERVIEW: "Pregled",
    ITEMS: "Stavke",
    SETTINGS: "Postavke",
    EXPAND: "Proširi navigaciju",
    COMPACT: "Sažmi navigaciju",
    CLOSE: "Zatvori navigaciju",
    OPEN: "Otvori navigaciju",
    QUICK: "Brza navigacija",
  },
  account: {
    LABEL: "Račun",
    OPEN_MENU: "Otvori izbornik računa",
    SIGN_OUT: "Odjava",
    SIGN_OUT_PENDING_TITLE: "Odbaciti izvanmrežne promjene i odjaviti se?",
    SIGN_OUT_PENDING_MESSAGE: "Odjava uklanja {{count}} promjena na čekanju ili neuspjelih promjena s ovog uređaja.",
  },
  auth: {
    outcomes: {
      unauthenticated: "Prijavite se za nastavak.",
      invalidCredentials: "Korisničko ime ili lozinka nisu ispravni.",
      forbidden: "Vašem računu nije dopušten pristup ovom radnom prostoru.",
      expiredSession: "Vaša je sesija istekla. Ponovno se prijavite.",
      offline: "Usluga prijave nije dostupna. Provjerite vezu i pokušajte ponovno.",
      server: "Usluga prijave privremeno nije dostupna. Pokušajte ponovno kasnije.",
      malformedResponse: "Usluga prijave vratila je neočekivan odgovor. Pokušajte ponovno ili kontaktirajte podršku.",
      logoutFailure: "Odjava nije dovršena. Još ste prijavljeni; pokušajte ponovno.",
    },
  },
  actions: { BACK: "Natrag" },
  loading: { application: "Učitavanje aplikacije", page: "Učitavanje stranice" },
  errorBoundary: {
    heading: "Došlo je do pogreške",
    message: "Ovu stranicu nije moguće prikazati. Pokušajte ponovno ili odaberite jednu od radnji za oporavak.",
    actions: "Radnje za oporavak aplikacije",
    retry: "Pokušaj ponovno",
    home: "Idi na početnu stranicu",
    reload: "Ponovno učitaj aplikaciju",
    signOut: "Odjava",
  },
  session: { expired: "Vaša je sesija istekla. Ponovno se prijavite." },
  pwa: {
    later: "Kasnije",
    offlineReady:
      "Aplikacijska ljuska spremna je za ograničeni izvanmrežni rad. Podaci s poslužitelja i dalje zahtijevaju vezu.",
    registrationUnavailable:
      "Izvanmrežna podrška nije omogućena. Osvježite stranicu ili se obratite podršci ako se ovo ponovi.",
    update: "Ažuriraj",
    updateReady: "Nova verzija je spremna.",
    updateUnavailable: "Ažuriranje nije primijenjeno. Nastavite raditi pa osvježite stranicu kada to bude sigurno.",
  },
  unsavedChanges: {
    title: "Odbaciti nespremljene promjene?",
    message: "Promjene će se izgubiti ako zatvorite ovaj obrazac.",
    keepEditing: "Nastavi uređivati",
    discard: "Odbaci promjene",
  },
} satisfies WidenLeaves<typeof en>;

export default hr;
