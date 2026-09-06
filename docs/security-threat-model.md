# Security threat model

Status: maintainer-authored baseline for the public `0.x` Template. It has not
received an independent application-security review.

## System and trust boundaries

The canonical deployment has four zones:

1. an untrusted browser and its persistent PWA storage;
2. a TLS-terminating ingress/static frontend that proxies same-origin `/api`
   requests;
3. a Spring Boot process using server-side sessions; and
4. a private PostgreSQL service.

The browser, request headers, URLs, generated identifiers, uploaded/imported data,
offline commands, and all application-owned fields are untrusted. The internal
container network reduces exposure but is not an authorization boundary. A valid
session identifies a user; endpoint and service authorization must still decide
whether that user can perform the requested domain action.

## Protected assets

- user credentials and session identifiers;
- CSRF tokens and authentication state;
- tenant, role, and domain authorization boundaries;
- application data, history, local offline data, and backups;
- database and deployment credentials;
- release artifacts, workflow credentials, provenance, and source integrity; and
- availability of login, API, database, synchronization, and recovery paths.

## Threat actors and assumptions

The model includes anonymous internet clients, authenticated users exceeding their
authority, credential-stuffing automation, a malicious site targeting an existing
session, compromised browser extensions/devices, accidental operators, dependency
or build-chain compromise, and attackers who obtain a backup or diagnostic
artifact. It does not assume the browser, local storage, internal network, proxy
headers, or application-owned validation is trustworthy.

TLS termination, secret storage, rate limiting, network policy, backup encryption,
central logging, alert delivery, and identity-provider controls belong to the
deployment. Domain authorization, data classification, tenant isolation, offline
eligibility, and conflict resolution belong to the application.

## Abuse cases and controls

| Abuse case                                    | Default/repository control                                                                                                                         | Application or deployment obligation                                                                                                                                            | Verification                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Credential stuffing or username discovery     | Authentication failures use one generic boundary and do not log passwords. The dev users are profile-scoped.                                       | Put login behind per-source and per-account throttling; add lockout/step-up policy appropriate to the product; never enable `dev` publicly.                                     | Security integration test plus deployment checklist; rate limiting remains deployment-specific. |
| Session fixation or theft                     | Login changes the session identifier; cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` by default in `prod`; URL session tracking is disabled. | Terminate HTTPS correctly, restrict trusted proxies, choose session concurrency/expiry, rotate secrets, and invalidate sessions after sensitive account changes where required. | Security integration test and production configuration policy.                                  |
| Cross-site request forgery                    | Cookie-to-header CSRF protection covers state-changing API calls; login/logout are deliberately exempt so clients can establish/clear a session.   | Keep APIs same-origin or perform a separate CORS/CSRF design review. Do not weaken CSRF merely to fix a frontend error.                                                         | Security integration and browser login tests.                                                   |
| Broken object/function authorization          | `/api/**` requires authentication and the Item capability declares role checks.                                                                    | Authorize every domain operation at endpoint and service boundaries; add tenant/object checks. Authentication alone is insufficient.                                            | Item integration tests; generated/application capabilities require their own tests.             |
| Injection, unsafe binding, or malformed input | DTO validation, explicit mapping, JPA parameters, query parsing, and generated Zod transport parsing reduce the exposed surface.                   | Keep entities out of write contracts, constrain files/URLs, and validate business invariants server-side.                                                                       | Unit/integration/generated-contract tests.                                                      |
| XSS or framing                                | React escaping, no runtime HTML injection in the canonical shell, CSP, `nosniff`, frame denial, referrer and permissions policy headers.           | Reassess CSP before adding third-party scripts, analytics, inline HTML, remote fonts, frames, camera, microphone, or geolocation.                                               | Production-like deployment header assertions.                                                   |
| Persistent Item/offline data disclosure or tampering | The admitted Item showcase stores its cache and replay queue in application-owned OPFS SQLite, scoped to the stable user ID; API traffic remains `NetworkOnly`. It clears data on logout/user switch, has no application-level at-rest encryption, and treats every replay body as untrusted. The server requires current `SUPERADMIN` authority before any replay classification or mutation. | Admit only classified data, keep user/tenant scoping and purge paths correct, document device/browser-storage exposure, and add product encryption/key-management only after a dedicated design review. | PWA/offline contracts; replay authorization integration tests; product threat-model review. |
| Stale or poisoned service worker              | Update registration is prompt-driven with hourly discovery; API routes are excluded from navigation fallback and runtime API caching.               | Preserve versioned immutable assets and the recovery procedure when changing hosting/CDN behavior.                                                                              | Unit prompt/error checks, source/built PWA contracts, Chromium shell/cache tests, and a two-build waiting-worker activation/reload fixture; physical evidence remains open. |
| Database or backup disclosure                 | PostgreSQL is not externally published by the canonical Compose deployment. Application logs exclude datasource credentials by policy.             | Use least-privilege credentials, encrypted transport/storage/backups, retention controls, restore access auditing, and secret rotation.                                         | Deployment policy and backup/restore rehearsal.                                                 |
| Supply-chain compromise                       | Lockfiles, pinned actions/images, dependency review, CodeQL, audits, secret scans, signed/provenanced releases, and SBOM attestations.             | Review update PRs and protected-environment changes; revoke unused tokens.                                                                                                      | Hosted security/release workflows.                                                              |
| Health/diagnostic leakage                     | Only health and info are exposed; readiness returns status without environment values.                                                             | Authenticate or network-restrict expanded Actuator endpoints and scrub logs/telemetry.                                                                                          | Deployment smoke and configuration policy.                                                      |

## Default authentication decision

Vireo's database username/password implementation is a replaceable demonstrative
baseline, not a complete production identity system. It provides password hashing,
session fixation protection, CSRF, generic HTTP boundaries, account-change flows,
and replacement seams. It does not supply MFA, breached-password checks,
distributed login throttling, recovery, identity proofing, federation, tenant
policy, or an operator console. A deployment must either add the missing controls
for its threat model or replace the `UserDetailsService`/`SecurityFilterChain` with
an established identity provider.

## Review triggers

Re-run this model when authentication, tenant boundaries, offline persistence,
service-worker caching, upload/import, third-party scripts, public Actuator
endpoints, deployment topology, or package publication changes. Before 1.0, obtain
an independent review and record scope, revision, methods, findings, remediation,
and residual risk without publishing exploit details prematurely.

Primary references: [Spring Security servlet protections](https://docs.spring.io/spring-security/reference/servlet/exploits/index.html),
[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/),
and [OWASP threat modeling](https://owasp.org/www-community/Threat_Modeling).
