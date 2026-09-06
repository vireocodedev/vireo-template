# Generated capabilities

The root `vireo` script pins the `vireo` executable from `create-vireo@0.9.0`.
The [`starter-template@0.9.0` release contract](https://github.com/vireocodedev/vireo-template/blob/starter-template%400.9.0/contracts/template-release-policy.json)
keeps that generator line aligned with the Template release coordinates.
Use that command for supported entity generation, the retained historical
0.2.0-to-0.3.0, 0.6.0-to-0.7.0, and 0.7.0-to-0.8.0 project upgrades, and the
historical 0.8.0-to-0.8.1, 0.8.1-to-0.8.2, and 0.8.2-to-0.8.3, plus the
historical 0.8.3-to-0.8.4 and 0.8.4-to-0.8.6 transforms, and the historical
0.8.6-to-0.8.7 transform, and the supported
adjacent 0.8.7-to-0.9.0 project upgrade. The Template contract separately retains 0.8.4-to-0.8.5 solely
as non-executable superseded evidence: no public `create-vireo@0.8.5` CLI was
released. When developing unpublished Starter changes, use the built CLI from a
local Starter checkout as shown in the framework's [entity-generator
guide](https://github.com/vireocodedev/vireo/blob/main/docs/generators/entity-schema.md).

Review the included realistic schema without writing:

```bash
corepack npm run vireo -- generate entity .vireo/examples/purchase-order.entity.json --dry-run
```

Generate and verify it:

```bash
corepack npm run vireo -- generate entity .vireo/examples/purchase-order.entity.json
corepack npm run generate:check
./gradlew test
cd frontend
corepack npm run typecheck
corepack npm run test
```

The generated route appears automatically through `frontend/src/generated/vireo.capabilities.ts`. The generated page includes responsive list/form composition and loading, empty, error, create, edit, and delete states. Spring component/entity scanning discovers the backend; entity-specific query and history registrations require no handwritten central enum edit.

Generated-once files are application-owned. Mechanical schema, contract, manifest, and capability-index files are regenerated. Vireo refuses unmanaged collisions and customized managed files by default. Read the [ownership contract](https://github.com/vireocodedev/vireo/blob/main/docs/architecture/generated-code-ownership.md) before using overwrite flags.

To retain every application file but stop Vireo from registering or contract-checking the capability:

```bash
corepack npm run vireo -- eject purchase-orders --dry-run
corepack npm run vireo -- eject purchase-orders
```

Schema v1 intentionally refuses relationships, compound identifiers, and offline generation instead of emitting partial code. The application remains free to implement those shapes manually after ejection.
