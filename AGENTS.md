# Vireo Template Maintainers

This repository is the source Template consumed by `create-vireo`, not a generated application. Keep maintainer guidance separate from projected application guidance.

## Routing

- Template plan, change/feature, fix, review, docs, verify, or release/operate: start with [$vireo-template](.agents/skills/vireo-template/SKILL.md). The user-level `$vireo` router owns cross-repository routing; do not duplicate it here.
- Template source and projection maintenance: the router uses [$vireo-template-maintainer](.agents/skills/vireo-template-maintainer/SKILL.md).
- Frontend behavior and infrastructure: read [frontend/AGENTS.md](frontend/AGENTS.md).
- JVM application code, Flyway, and HTTP boundaries: read [src/AGENTS.md](src/AGENTS.md).
- Launchers, policies, verification, and release logic: read [scripts/AGENTS.md](scripts/AGENTS.md).

The router's [common workflow](.agents/skills/vireo-template/references/workflow.md) owns lifecycle, projection, dependency-mode, approval, and receipt rules. Skill instructions guide behavior; they do not enforce security or replace sandbox, tool permissions, or protected hosted gates.

## Working conventions

- Issues and specs: [GitHub Issues](docs/agents/issue-tracker.md).
- Triage: [label vocabulary](docs/agents/triage-labels.md).
- Domain documentation: [single-context layout](docs/agents/domain.md).
