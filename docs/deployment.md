# Deployment

The backend and frontend are independent build and deployment units. Gradle builds only the Spring Boot API; npm builds only the React PWA. The backend never invokes npm or embeds `frontend/dist` in its JAR.

## Build the artifacts

The backend resolves Vireo libraries anonymously from Maven Central and the
frontend resolves them anonymously from npm. Then run:

```bash
./gradlew clean bootJar
cd frontend
corepack npm ci
corepack npm run build
```

The backend artifact is `build/libs/app.jar`, and the frontend artifact is `frontend/dist`. The deterministic JAR name is intentional: the checked-in backend Dockerfile never guesses between a Spring Boot archive and a plain Java archive.

Both Docker contexts are enforced allowlists. The backend admits only its
`.dockerignore`, Dockerfile, and application JAR under a 75 MiB budget. The frontend
admits only its `.dockerignore`, Dockerfile, Nginx configuration, and `dist` tree
under a 10 MiB budget. This prevents source trees, caches, reports, and dependencies
from being sent to the Docker daemon. Both runtime base images and the Compose
PostgreSQL image are pinned by digest. The backend health probe uses only tools from
the pinned JRE image, so its build performs no network package installation.

## Run the production-like deployment

```bash
POSTGRES_OWNER_PASSWORD=change-owner-me \
POSTGRES_RUNTIME_PASSWORD=change-runtime-me \
SESSION_COOKIE_SECURE=false \
docker compose up
```

`SESSION_COOKIE_SECURE=false` is only for an HTTP-only local container check. Keep the production default (`true`) behind HTTPS.

Open <http://localhost:3000>. Compose builds two independent runtime images, waits for
PostgreSQL and backend readiness, then starts an unprivileged Nginx frontend. The
frontend serves the PWA with history fallback and proxies `/api` over the internal
Compose network. The frontend is published on host loopback only. Neither PostgreSQL
nor the backend port is published to the host.

The development launcher adds `compose.dev.yaml`, which publishes PostgreSQL on
`127.0.0.1:5432` for the host-side Spring Boot process. Do not add that descriptor to
a deployed environment.

For the same disposable production-like check used by CI, run:

```bash
./scripts/verify-deployment.sh
```

The script rebuilds the JAR and frontend bundle before it adds `compose.smoke.yaml`,
creates an ephemeral smoke-only administrator, and drives Chromium through login,
Item creation, and a reload that proves the write reached PostgreSQL. The smoke
profile requires credentials and is not enabled by the base deployment descriptor.
The stack and its volume are removed when the check finishes.

Both images run as unprivileged users. Do not expose the database port or Actuator
beyond the network boundaries that need them. A different static host or edge
platform may deploy `frontend/dist` directly if it preserves the same history
fallback, service-worker cache behavior, HTTPS, and `/api` routing contract.

## Required production configuration

<table>
  <thead>
    <tr><th>Variable</th><th>Purpose</th></tr>
  </thead>
  <tbody>
    <tr><td><code>SPRING_DATASOURCE_URL</code></td><td>PostgreSQL JDBC URL</td></tr>
    <tr><td><code>SPRING_DATASOURCE_USERNAME</code></td><td>Database account</td></tr>
    <tr><td><code>SPRING_DATASOURCE_PASSWORD</code></td><td>Database secret</td></tr>
    <tr><td><code>SPRING_FLYWAY_USER</code></td><td>Dedicated schema owner/migration account</td></tr>
    <tr><td><code>SPRING_FLYWAY_PASSWORD</code></td><td>Dedicated schema owner/migration secret</td></tr>
    <tr><td><code>SPRING_PROFILES_ACTIVE=prod</code></td><td>Enables production-safe application defaults</td></tr>
    <tr><td><code>SESSION_COOKIE_SECURE</code></td><td>Defaults to <code>true</code>; disable only for local HTTP checks</td></tr>
  </tbody>
</table>

The canonical Compose deployment creates separate database identities. Flyway connects as the schema owner, while the application pool connects as a runtime role limited to application table/sequence DML. The runtime role cannot create schema objects or mutate `flyway_schema_history`. Supply independent `POSTGRES_OWNER_PASSWORD` and `POSTGRES_RUNTIME_PASSWORD` secrets; changing either variable for an existing volume requires an explicit credential rotation because PostgreSQL initialization scripts run only when the data directory is first created.

The `prod` profile fails during environment preparation when the resolved datasource URL uses `jdbc:h2:`. H2 remains available for development and tests, but production must use an explicitly configured external datasource so a missing deployment secret cannot silently select embedded storage.

Terminate TLS at the ingress or reverse proxy, forward the standard proxy headers, retain the default `HttpOnly` and `SameSite=Lax` session cookie settings, and store secrets in the deployment platform rather than an image or repository file. The offline heartbeat stream at `/api/offline/heartbeat/stream` is SSE: preserve its `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers, do not buffer or cache it, and configure an HTTP/1.1-equivalent upstream connection with an idle/read timeout safely above its 5-second heartbeat interval. The canonical Nginx configuration uses 60 seconds.

Before exposing an environment, complete the [security hardening
guide](security-hardening.md) and review the [threat
model](security-threat-model.md). The canonical frontend image supplies a
same-origin content security policy, frame denial, MIME-sniffing prevention,
referrer policy, browsing-context isolation, and a deny-by-default permissions
policy. Preserve or deliberately replace those headers at the public ingress.

Before the first production release, connect the [operations and observability
baseline](operations.md), rehearse [database backup and recovery](database-recovery.md),
and assign the roles and contact paths in the [incident-response
playbook](incident-response.md).

## Release check

Before producing the image, run the same merge gate as CI:

```bash
./scripts/verify.sh
```

After deployment, verify readiness and then exercise login plus one authenticated API request through the public origin.

For a disposable evaluation environment, use the isolated [flagship demo operations contract](flagship-demo.md). It adds deterministic public seed data, a scoped reset procedure, and an external synthetic journey without weakening the normal production profile.
