#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

deployment_project="vireo-template-smoke-${GITHUB_RUN_ID:-local}"
frontend_port="${FRONTEND_PORT:-3000}"
export POSTGRES_OWNER_PASSWORD="${POSTGRES_OWNER_PASSWORD:-deployment-owner-only}"
export POSTGRES_RUNTIME_PASSWORD="${POSTGRES_RUNTIME_PASSWORD:-deployment-runtime-only}"
export SESSION_COOKIE_SECURE=false
export VIREO_DEPLOYMENT_SMOKE_USERNAME="${VIREO_DEPLOYMENT_SMOKE_USERNAME:-deployment_smoke}"
export VIREO_DEPLOYMENT_SMOKE_PASSWORD="${VIREO_DEPLOYMENT_SMOKE_PASSWORD:-deployment-smoke-${RANDOM}-${RANDOM}}"

if docker compose version >/dev/null 2>&1; then
  compose_command=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  compose_command=(docker-compose)
else
  printf 'Docker Compose is required for the deployment smoke.\n' >&2
  exit 1
fi

cleanup() {
  "${compose_command[@]}" -f compose.yaml -f compose.smoke.yaml --project-name "$deployment_project" \
    down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

./gradlew bootJar --console=plain
(
  cd frontend
  corepack npm run build
)

"${compose_command[@]}" -f compose.yaml -f compose.smoke.yaml --project-name "$deployment_project" \
  up --build --detach --wait

index_document="$(curl --fail --silent --show-error "http://127.0.0.1:${frontend_port}/")"
if [[ "$index_document" != *'<div id="root"></div>'* ]]; then
  printf 'Frontend deployment did not return the application shell.\n' >&2
  exit 1
fi

response_headers="$(curl --fail --silent --show-error --head "http://127.0.0.1:${frontend_port}/")"
for expected_header in \
  "content-security-policy: default-src 'self'" \
  "cross-origin-opener-policy: same-origin" \
  "permissions-policy: camera=(), geolocation=(), microphone=()" \
  "referrer-policy: strict-origin-when-cross-origin" \
  "x-content-type-options: nosniff" \
  "x-frame-options: DENY"; do
  if ! grep --ignore-case --fixed-strings --quiet "$expected_header" <<<"$response_headers"; then
    printf 'Frontend deployment is missing security header: %s\n' "$expected_header" >&2
    exit 1
  fi
done

for pwa_asset in /sw.js /manifest.webmanifest; do
  pwa_headers="$(curl --fail --silent --show-error --head "http://127.0.0.1:${frontend_port}${pwa_asset}")"
  if ! grep --ignore-case --fixed-strings --quiet "cache-control: no-cache" <<<"$pwa_headers"; then
    printf 'Frontend deployment is missing no-cache PWA metadata policy for %s.\n' "$pwa_asset" >&2
    exit 1
  fi
  if [[ "$pwa_asset" == "/manifest.webmanifest" ]] &&
    ! grep --ignore-case --fixed-strings --quiet "content-type: application/manifest+json" <<<"$pwa_headers"; then
    printf 'Frontend deployment is missing the manifest MIME type.\n' >&2
    exit 1
  fi
done

api_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${frontend_port}/api/auth/me")"
if [[ "$api_status" != "401" ]]; then
  printf 'Frontend API proxy returned HTTP %s; expected the backend authentication boundary (401).\n' "$api_status" >&2
  exit 1
fi

if ! curl --fail --silent --show-error \
  "http://127.0.0.1:${frontend_port}/actuator/health/readiness" | grep --quiet '"status":"UP"'; then
  printf 'Public backend readiness did not report UP.\n' >&2
  exit 1
fi

"${compose_command[@]}" --project-name "$deployment_project" exec --no-TTY frontend \
  wget --quiet --output-document=- http://app:8080/actuator/health/readiness | grep --quiet '"status":"UP"'

runtime_user="${POSTGRES_RUNTIME_USER:-starter_template_runtime}"
database_name="${POSTGRES_DB:-starter_template}"
runtime_privileges="$("${compose_command[@]}" --project-name "$deployment_project" exec --no-TTY postgres \
  psql --username "${POSTGRES_OWNER_USER:-starter_template_owner}" --dbname "$database_name" --tuples-only --no-align \
  --command "SELECT has_schema_privilege('$runtime_user', 'public', 'CREATE'), has_table_privilege('$runtime_user', 'item', 'SELECT') AND has_table_privilege('$runtime_user', 'item', 'INSERT') AND has_table_privilege('$runtime_user', 'item', 'UPDATE') AND has_table_privilege('$runtime_user', 'item', 'DELETE'), has_table_privilege('$runtime_user', 'flyway_schema_history', 'INSERT') OR has_table_privilege('$runtime_user', 'flyway_schema_history', 'UPDATE') OR has_table_privilege('$runtime_user', 'flyway_schema_history', 'DELETE') OR has_table_privilege('$runtime_user', 'flyway_schema_history', 'TRUNCATE') OR has_table_privilege('$runtime_user', 'flyway_schema_history', 'REFERENCES') OR has_table_privilege('$runtime_user', 'flyway_schema_history', 'TRIGGER');")"
if [[ "$runtime_privileges" != "f|t|f" ]]; then
  printf 'Runtime database privileges are unsafe or incomplete: %s (expected f|t|f).\n' "$runtime_privileges" >&2
  exit 1
fi

(
  cd frontend
  VIREO_DEPLOYMENT_BASE_URL="http://127.0.0.1:${frontend_port}" \
    corepack npm exec -- playwright test --config=playwright.deployment.config.ts
)

printf 'Production-like deployment smoke passed: built browser application, authenticated persisted CRUD and incremental SSE heartbeats, security headers, API proxy, backend readiness, PostgreSQL health, and separated database privileges.\n'
