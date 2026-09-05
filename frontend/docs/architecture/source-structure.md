# Source structure

```text
src/
├── @types/                 ambient declarations and module augmentation only
├── app/                    global composition and infrastructure
├── features/               reusable application capabilities
├── generated/              managed generated-capability registry and slices
├── pages/                  route entry points and page-private code
├── main.css                browser and root-element fundamentals only
├── main.tsx                React bootstrap only
└── vite-env.d.ts
```

`app` has this stable shape:

```text
app/
├── App.tsx
├── adapters/               explicit feature-to-app composition boundary
├── app.localization.ts
├── app.pages.ts
├── app.providers.tsx
├── init-signal-effects.ts   global signal-effect initialization
├── config/
├── data/network/
├── data/query/
├── diagnostics/             application-wide technical error reporting
├── shell/{components,contexts,hooks,layout,providers}/
└── ui/{assets,forms,localization,preferences,theme}/
```

`generated/` is generator-managed application source. Its root registry is consumed only by `app.pages.ts` and `app.localization.ts`; generated slices may import other files within `generated/`. Customize declared extension zones or eject before changing managed regions.

A feature uses only the directories it needs:

```text
features/<feature>/
├── public.ts
├── api/                    may expose a scoped public.ts when bundle evidence requires it
├── assets/
├── components/
├── contexts/
├── hooks/
├── localization/
├── models/
├── offline/
├── providers/
├── services/
├── signals/                signal definitions only
├── state/
├── storybook/              feature-level fixtures and stories when separation is clearer
└── tests/                  feature-local test support when it is not a repository-level test
```

Every reusable React component gets a PascalCase directory with its same-named implementation, test, and—when valuable—story. Component-private complexity goes under `internal/`. There are no component `index.ts` barrels.

Entity form-field components live at `features/<feature>/components/forms/<Entity>FormFields/<Entity>FormFields.tsx`. They follow the shared contract in [models-forms-and-validation.md](./models-forms-and-validation.md); form boundaries and actions remain outside them.

Pages use kebab-case route directories. The route component lives directly in the page directory; private collaborators live in `internal/`. Pages do not export `public.ts` and never import other pages. Dev-tool page examples may mirror feature structure locally, without a nested `src/` directory.

File names are PascalCase for React components, contexts, providers, and model contracts; hooks start with `use`; non-React modules use descriptive kebab-case suffixes such as `.api`, `.query`, and `.localization`.

Global reactive state uses Preact Signals. Signal definitions live in a `signals/` directory, are named `sig<Name>.ts`, and export signals only. Put mutations in typed action modules, and initialize global effects once from `app/init-signal-effects.ts` before React renders in `main.tsx`.
