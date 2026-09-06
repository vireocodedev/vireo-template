# Provider-control desired state and evidence — 2026-08-31

Status: **live machine controls applied and authenticated; human continuity gaps remain**

The Template's `.github/settings/actions.json` (including SHA pinning) and
`selected-actions.json` are separate GitHub REST PUT payloads. The `template-release.json` environment PUT
payload is separate from its `.deployment-branch-policies.json` POST collection;
they must not be sent as one combined payload.

`template-release.live-assertions.json` retains the required no-administrator-
bypass state. GitHub does not expose that environment setting through the
documented REST or GraphQL schemas used here, so a maintainer must disable it in
the GitHub UI and retain both UI confirmation and an authenticated environment GET
export. The sole currently evidenced owner is `@brunotot`; independent review and
a backup-owner recovery exercise remain open until a second trusted maintainer is
available.

At `2026-08-31T21:05:49Z`, authenticated reads confirmed active no-bypass main
ruleset `21958166`, immutable-tag rulesets `21958135` for 0.7.0 and `21926710`
for 0.6.0, the exact selected/SHA-pinned Actions policy, read-only workflow
defaults without PR approval, an empty CODEOWNERS error list, and
`template-release` policies limited to branch `main` and tag pattern
`starter-template@*`. After the maintainer disabled administrator bypass in the
GitHub UI, an authenticated read at `2026-08-31T21:32:11Z` reports
`can_admins_bypass: false`. This closes the Template's machine-controlled
provider-security portion; independent review and backup-owner recovery remain
human gaps.

## Release-payload inventory

The source inventory retains immutable ruleset payloads for historical release
tags, including the immediately prior `starter-template@0.9.0` tag and the
superseded Template-only `starter-template@0.8.5` release that had no paired
public `create-vireo@0.8.5` release. It also contains the
exact no-bypass update-and-deletion payload for the prepared
`starter-template@0.9.1` tag in
`.github/rulesets/starter-template-0.9.1.json`. That checked-in payload is a
reviewable desired state, not evidence that GitHub has applied it: create and
read back the matching active provider ruleset before pushing the release tag.

The retained `.github/rulesets/starter-template-0.8.7.json` documents the
already-published `starter-template@0.8.7` coordinate. It is not evidence that GitHub has applied it as a provider control for future versions.

The authoritative desired state for every future Template release is
`.github/rulesets/starter-template-tags.json`: an active, no-bypass,
update/non-fast-forward/deletion ruleset matching `refs/tags/starter-template@*`. Apply that
payload once through GitHub's ruleset API or UI and read it back. The main-push
release workflow fails closed before tag or release mutation unless the live
wildcard ruleset matches every field observable to its read-only token. GitHub can
omit `bypass_actors` from that response, so no-bypass remains administrator-confirmed
desired/live state rather than a per-run proof. The
`template-release` environment must retain reviewers `[]`, wait `0`, disabled
administrator bypass, and branch policy limited to `main`. Merging the
release-coordinate PR on `main`, rather than a recurring environment approval, is
explicit publication authorization.

## One-time activation for the automated release path

Before merging the first release-coordinate PR that relies on this path, a repository
administrator must:

1. Create or update the live tag ruleset from
   `.github/rulesets/starter-template-tags.json`, then read it back and confirm the
   wildcard, active enforcement, no bypass actors, and exactly the
   update/non-fast-forward/deletion rules.
2. Update the `template-release` environment from
   `.github/environments/template-release.json`, remove the former tag deployment
   policy, and retain only the `main` policy in
   `.github/environments/template-release.deployment-branch-policies.json`.
3. Confirm GitHub's repository-level **immutable releases** setting remains enabled.

The workflow has no credential that can replace these administrator-only controls.
It does verify every observable live wildcard-ruleset field before every mutation and
fails closed if one drifts. The environment no longer needs a recurring release approval after the
release-coordinate PR has merged.
