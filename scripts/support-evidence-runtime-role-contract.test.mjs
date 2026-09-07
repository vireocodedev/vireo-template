import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  join(root, ".github/workflows/support-evidence.yml"),
  "utf8",
);
const recovery = readFileSync(
  join(root, "scripts/verify-database-recovery.sh"),
  "utf8",
);
const runtimeRoleBootstrap = readFileSync(
  join(root, "deploy/postgres/init-runtime-role.sh"),
  "utf8",
);

test("hosted PostgreSQL support fixtures require the production runtime role", () => {
  for (const requiredWorkflowFragment of [
    "image: postgres:${{ matrix.postgresql }}",
    "docker image inspect postgres:${{ matrix.postgresql }}",
    "POSTGRES_USER: starter_template_owner",
    "POSTGRES_RUNTIME_USER: starter_template_runtime",
    "POSTGRES_RUNTIME_PASSWORD: support-runtime-only-password",
    "docker cp deploy/postgres/init-runtime-role.sh",
    "SPRING_PROFILES_ACTIVE: prod,dev",
    "SPRING_DATASOURCE_USERNAME: starter_template_runtime",
    "SPRING_FLYWAY_USER: starter_template_owner",
  ]) {
    assert.ok(
      workflow.includes(requiredWorkflowFragment),
      `support evidence must retain ${requiredWorkflowFragment}`,
    );
  }

  for (const requiredRecoveryFragment of [
    "database_owner='starter_template_owner'",
    "database_runtime='starter_template_runtime'",
    "bootstrap_runtime_role \"$source_container\"",
    "bootstrap_runtime_role \"$target_container\"",
    "SPRING_DATASOURCE_USERNAME=\"$database_runtime\"",
    "SPRING_FLYWAY_USER=\"$database_owner\"",
    "prod,dev",
    'pg_isready --host 127.0.0.1 --username "$database_owner" --dbname "$database_name"',
    "INSERT INTO item (id, name, description, quantity, status, deleted)",
    "00000000-0000-4000-8000-000000000042",
  ]) {
    assert.ok(
      recovery.includes(requiredRecoveryFragment),
      `database recovery rehearsal must retain ${requiredRecoveryFragment}`,
    );
  }

  assert.ok(
    !recovery.includes('pg_isready --username "$database_owner" --dbname "$database_name"'),
    "database recovery rehearsal must not accept the temporary PostgreSQL initialization socket",
  );
  assert.ok(
    !recovery.includes("INSERT INTO item (name, description, quantity, status, deleted)"),
    "database recovery rehearsal must provide the required item UUID explicitly",
  );
});

test("the shared production runtime-role bootstrap remains fail-closed and re-runnable", () => {
  for (const requiredFragment of [
    ': "${POSTGRES_USER:?POSTGRES_USER is required}"',
    ': "${POSTGRES_RUNTIME_USER:?POSTGRES_RUNTIME_USER is required}"',
    ': "${POSTGRES_RUNTIME_PASSWORD:?POSTGRES_RUNTIME_PASSWORD is required}"',
    "WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vireo_runtime_dml')",
    "tablename <> 'flyway_schema_history'",
  ]) {
    assert.ok(
      runtimeRoleBootstrap.includes(requiredFragment),
      `runtime-role bootstrap must retain ${requiredFragment}`,
    );
  }
});
