# Security policy

## Supported versions

The current `main` branch and the latest tagged template release receive security updates. Applications created from the template own their deployed versions and must regularly merge or port upstream fixes.

The [`starter-template@0.9.0` release contract](contracts/template-release-policy.json)
requires GitHub immutable releases before publishing the corresponding
[release](https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%400.9.0).
Repository administrators must enable that GitHub setting; the release workflow's
default token cannot verify it. The checked-in wildcard tag desired state requires
no bypass actors, and an administrator must confirm that condition through an
authenticated provider read. The read-only workflow token validates every observable
wildcard rule before mutation, but GitHub may omit `bypass_actors` from that token's
ruleset response. The workflow also verifies the published release API reports
`immutable: true` with the exact attached release manifest.

## Reporting a vulnerability

Do not open a public issue. Use GitHub private vulnerability reporting for `vireocodedev/vireo-template` and include the affected revision, reproduction steps, impact, and proposed mitigation when available.

Maintainers target acknowledgement of a complete report within two business days
and initial severity/next-step triage within five business days. Once confirmed,
the remediation targets are 7 calendar days for critical, 30 days for high, 90 days
for medium, and the next appropriate release for low severity. These are operating
targets rather than warranties; if a safe fix needs longer, maintainers document
containment and a revised private target. Confirmed issues are handled through a
private advisory and coordinated disclosure when appropriate.

The maintainer-authored [threat model](docs/security-threat-model.md) and
[production hardening guide](docs/security-hardening.md) define the current scope
and explicitly identify controls owned by an application or deployment. They do
not replace an independent security review.

For containment, evidence handling, communication, and recovery during an active
event, follow the private-routing rules in the [incident-response
playbook](docs/incident-response.md).

The `dev` profile intentionally creates documented sample users. It must never be enabled in a public environment. Never include production credentials or personal data in a report.

GitHub secret scanning and push protection supplement the repository-owned weekly
full-history Gitleaks scan. A clean scan reduces known exposure; it does not prove a
credential was never copied or exposed elsewhere.
