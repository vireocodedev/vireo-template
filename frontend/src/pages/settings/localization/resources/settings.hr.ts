import type { WidenLeaves } from "@vireocodedev/localization";
import type en from "./settings.en";
const hr = {
  header: { title: "Postavke", description: "Prilagodite ponašanje i prikaz podataka u ovom radnom prostoru." },
  search: { placeholder: "Pretraži postavke", empty: "Nijedna postavka ne odgovara upitu „{{search}}”." },
  sections: { appearance: "Izgled", layout: "Raspored", offline: "Izvan mreže", defaults: "Zadane vrijednosti" },
  offline: {
    simulation: {
      title: "Simulator izvan mreže",
      description: "Zadržite ovu karticu izvan mreže i isključite tok stvarnog vremena.",
      unavailable: "Ponovno učitajte aplikaciju. Ako pohrana ostane nedostupna, koristite HTTPS ili localhost.",
    },
    replayFailure: {
      title: "Neuspješan sljedeći pokušaj",
      description: "Jednom zaustavite sljedeću sinkronizaciju reda radi pregleda ponovnog pokušaja.",
    },
    status: {
      title: "Izvanmrežno stanje",
      description: "{{connection}} · predmemorija {{cache}} · na čekanju {{pending}} · neuspjelo {{failed}}",
      ONLINE: "Na mreži",
      OFFLINE: "Izvan mreže",
      ready: "spremna",
      unavailable: "nedostupna",
    },
    retry: "Ponovno uskladi i pokušaj",
    action: {
      retryFailed: "Promjene na čekanju nisu ponovno poslane. Provjerite vezu i pokušajte ponovno.",
      discardFailed: "Lokalne promjene nisu odbačene. Pokušajte ponovno.",
      resetFailed: "Lokalna predmemorija nije ponovno postavljena. Osvježite aplikaciju i pokušajte ponovno.",
    },
    discard: {
      title: "Zadrži promjene poslužitelja",
      description: "Odbacite lokalne promjene stavki i zadržite trenutačnu verziju na poslužitelju.",
      action: "Odbaci",
    },
    reset: {
      title: "Ponovno postavi lokalnu predmemoriju",
      description: "Ponovno pokrenite lokalnu predmemoriju stavki u pregledniku.",
      action: "Ponovno postavi",
    },
  },
  language: {
    title: "Jezik",
    description: "Odaberite jezik i regionalno oblikovanje koje se koristi u cijeloj aplikaciji.",
    ENGLISH: "Engleski",
    CROATIAN: "Hrvatski",
  },
  theme: { title: "Tamni način", description: "Koristite tamnu paletu radnog prostora u cijeloj aplikaciji." },
  tableDensity: {
    title: "Gustoća tablice",
    description: "Odaberite količinu okomitog prostora koju koriste responzivne tablice.",
    COMPACT: "Zbijeno",
    COMFORTABLE: "Udobno",
  },
  pageWidth: {
    title: "Širina sadržaja stranice",
    description: "Ograničite sadržaj radi čitljivosti ili mu dopustite sav dostupan prostor.",
    MEDIUM: "Srednje",
    LARGE: "Veliko",
    EXTRA_LARGE: "Vrlo veliko",
    FULL: "Bez maksimuma",
  },
  desktopSurface: {
    title: "Površina obrasca na računalu",
    description: "Odaberite kako se responzivni obrasci prikazuju na računalu.",
    DIALOG: "Dijalog",
    OVERLAY: "Bočni panel preko sadržaja",
    DOCKED: "Usidreni bočni panel",
  },
  resizablePanels: {
    title: "Promjenjiva širina panela",
    description: "Dopustite promjenu širine bočnih panela pokazivačem.",
  },
  lockNavigation: {
    title: "Zaključaj navigaciju",
    description: "Spriječite promjenu širine uz očuvanje trenutačnog proširenog ili sažetog načina.",
  },
  reset: {
    title: "Vrati postavke aplikacije",
    description: "Vratite sve lokalne postavke prikaza na izvorne vrijednosti.",
    action: "Vrati postavke",
  },
} satisfies WidenLeaves<typeof en>;
export default hr;
