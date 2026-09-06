# Support

Vireo Starter Template is a public `0.x` reference application maintained on a
best-effort basis. There is no guaranteed response or resolution time.

## Where to ask

- Use the bug form for a reproducible defect in the unmodified Template.
- Use the feature-request form for a proposal about the reusable Template baseline.
- Report a reusable Vireo package defect in the
  [Vireo repository](https://github.com/vireocodedev/vireo/issues).
- Follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities. Never disclose
  vulnerability details in a public issue.

The maintainer-operated demo at <https://demo.vireocode.com> is a disposable
evaluation sandbox, not a hosted-service commitment. Report a reproducible outage
through the Template bug form. It is handled by repository maintainers on a
best-effort basis with no response-time or uptime SLA.

Include the Template revision or tag, exact Starter artifact versions, reproduction,
expected and actual behavior, and environment. Search existing issues first.

Release coordinates are published with the
[`starter-template@0.9.1` release contract](contracts/template-release-policy.json)
and its draft-and-publish
[GitHub release](https://github.com/vireocodedev/vireo-template/releases/tag/starter-template%400.9.1).
Repository administrators must enable GitHub immutable releases before publishing.

Merging the release-coordinate pull request is explicit publication authorization.
When it reaches `main`, GitHub Actions validates the exact commit,
creates its annotated immutable tag through GitHub's REST API, creates or recovers a
matching draft release, attaches the exact manifest, and publishes only after the
manifest and immutable-release API state match. Ordinary later `main` commits are a
verified no-op for the already published coordinate.

## Immutable release recovery

Never move, delete, or recreate an immutable release tag. If a release workflow
needs recovery, use the pinned `main` workflow-dispatch path with the existing
release tag and its expected commit
[`5b123e60bd1ce733ae70711796552a17aaa60fe3`](contracts/template-release-recovery.json).
Stop immediately if that tag already has a draft or published GitHub release;
investigate the existing release rather than attempting to replace it.

The `template-release` protected GitHub environment has no recurring reviewer: the
merged `main` release-coordinate PR is the publication gate. It retains zero wait,
no administrator bypass, and main-only deployment policy. The workflow deliberately
does not attempt the administration-only immutable-release setting check with its
repository token. The wildcard update/non-fast-forward/deletion tag ruleset for
`starter-template@*` must be active before release mutation; the workflow reads and
compares every observable live field before creating a tag or release. GitHub can
omit `bypass_actors` from the read-only workflow token; no-bypass remains a checked-in
desired state and an administrator-confirmed live assertion. Historical exact-tag
ruleset files remain evidence for old tags and the pinned 0.6.0 recovery path.
The workflow also requires that immutable releases are still enabled through the
repository's administrator-controlled GitHub setting.

## Support boundary

The Template demonstrates integration; it is not a hosted service, generated
application, or private consulting engagement. Maintainers do not operate derived
applications or guarantee help with product-specific domain rules, authorization,
sensitive data, deployment, offline eligibility, conflict resolution, or changes
made after cloning. Application owners are responsible for those decisions and for
regularly integrating upstream fixes.

Issues may be closed when they cannot be reproduced on the unmodified Template,
concern unsupported versions, lack requested information, or belong to an
application or upstream package. An accepted report does not imply a delivery date.

Participation follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Use test data and
remove credentials, personal data, and confidential details from public reports.
