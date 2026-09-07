#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

postgres_17_image='postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
postgres_18_image='postgres@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2'
run_suffix="${GITHUB_RUN_ID:-local}-$$"
network_name="vireo-recovery-${run_suffix}"
source_container="vireo-recovery-source-${run_suffix}"
target_container="vireo-recovery-target-${run_suffix}"
database_name='starter_template'
database_owner='starter_template_owner'
database_owner_password='recovery-owner-only'
database_runtime='starter_template_runtime'
database_runtime_password='recovery-runtime-only'
source_app_port=18081
target_app_port=18082
rehearsal_dir="$(mktemp -d /tmp/vireo-recovery.XXXXXX)"
source_app_pid=''
target_app_pid=''

stop_process() {
  local process_id="$1"
  if [[ -n "$process_id" ]] && kill -0 "$process_id" >/dev/null 2>&1; then
    kill "$process_id" >/dev/null 2>&1 || true
    wait "$process_id" >/dev/null 2>&1 || true
  fi
}

cleanup() {
  stop_process "$source_app_pid"
  stop_process "$target_app_pid"
  docker rm --force "$source_container" "$target_container" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
  if [[ "$rehearsal_dir" == /tmp/vireo-recovery.* && -d "$rehearsal_dir" ]]; then
    rm -rf -- "$rehearsal_dir"
  fi
}
trap cleanup EXIT

wait_for_database() {
  local container_name="$1"
  for _ in $(seq 1 60); do
    if docker exec "$container_name" pg_isready --host 127.0.0.1 --username "$database_owner" --dbname "$database_name" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  printf 'Database %s did not become ready.\n' "$container_name" >&2
  docker logs "$container_name" >&2 || true
  exit 1
}

bootstrap_runtime_role() {
  local container_name="$1"
  docker cp deploy/postgres/init-runtime-role.sh "$container_name:/tmp/vireo-runtime-role.sh"
  docker exec "$container_name" /bin/bash /tmp/vireo-runtime-role.sh
}

wait_for_application() {
  local port="$1"
  local log_file="$2"
  for _ in $(seq 1 90); do
    if curl --fail --silent "http://127.0.0.1:${port}/actuator/health/readiness" 2>/dev/null | grep --quiet '"status":"UP"'; then
      return
    fi
    sleep 1
  done
  printf 'Application on port %s did not become ready.\n' "$port" >&2
  sed -n '1,240p' "$log_file" >&2
  exit 1
}

start_application() {
  local database_port="$1"
  local application_port="$2"
  local profile="$3"
  local log_file="$4"
  SPRING_PROFILES_ACTIVE="$profile" \
  SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:${database_port}/${database_name}" \
  SPRING_DATASOURCE_USERNAME="$database_runtime" \
  SPRING_DATASOURCE_PASSWORD="$database_runtime_password" \
  SPRING_FLYWAY_USER="$database_owner" \
  SPRING_FLYWAY_PASSWORD="$database_owner_password" \
  SESSION_COOKIE_SECURE=false \
    java -jar build/libs/app.jar --server.port="$application_port" >"$log_file" 2>&1 &
  application_pid=$!
}

docker network create "$network_name" >/dev/null

docker run --detach --name "$source_container" --network "$network_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB="$database_name" \
  --env POSTGRES_USER="$database_owner" \
  --env POSTGRES_PASSWORD="$database_owner_password" \
  --env POSTGRES_RUNTIME_USER="$database_runtime" \
  --env POSTGRES_RUNTIME_PASSWORD="$database_runtime_password" \
  "$postgres_17_image" >/dev/null
wait_for_database "$source_container"
bootstrap_runtime_role "$source_container"
source_database_port="$(docker port "$source_container" 5432/tcp | awk -F: 'END { print $NF }')"

./gradlew bootJar
application_pid=''
start_application "$source_database_port" "$source_app_port" prod,dev "$rehearsal_dir/source-app.log"
source_app_pid="$application_pid"
wait_for_application "$source_app_port" "$rehearsal_dir/source-app.log"

docker exec "$source_container" psql --username "$database_owner" --dbname "$database_name" \
  --set ON_ERROR_STOP=1 --command \
  "INSERT INTO item (id, name, description, quantity, status, deleted) VALUES ('00000000-0000-4000-8000-000000000042', 'Recovery rehearsal marker', 'Preserved across PostgreSQL major versions', 42, 'ACTIVE', FALSE);" >/dev/null

source_item_count="$(docker exec "$source_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM item')"
source_user_count="$(docker exec "$source_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM app_user')"
source_migration_count="$(docker exec "$source_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM flyway_schema_history')"

stop_process "$source_app_pid"
source_app_pid=''

docker run --rm --network "$network_name" \
  --env PGPASSWORD="$database_owner_password" \
  --volume "$rehearsal_dir:/recovery" \
  "$postgres_18_image" \
  pg_dump --host "$source_container" --username "$database_owner" --dbname "$database_name" \
  --format custom --compress 9 --no-owner --no-privileges --file /recovery/recovery.dump

docker run --detach --name "$target_container" --network "$network_name" \
  --publish 127.0.0.1::5432 \
  --env POSTGRES_DB="$database_name" \
  --env POSTGRES_USER="$database_owner" \
  --env POSTGRES_PASSWORD="$database_owner_password" \
  --env POSTGRES_RUNTIME_USER="$database_runtime" \
  --env POSTGRES_RUNTIME_PASSWORD="$database_runtime_password" \
  "$postgres_18_image" >/dev/null
wait_for_database "$target_container"
bootstrap_runtime_role "$target_container"

docker run --rm --network "$network_name" \
  --env PGPASSWORD="$database_owner_password" \
  --volume "$rehearsal_dir:/recovery:ro" \
  "$postgres_18_image" \
  pg_restore --host "$target_container" --username "$database_owner" --dbname "$database_name" \
  --exit-on-error --single-transaction --no-owner --no-privileges /recovery/recovery.dump

bootstrap_runtime_role "$target_container"

target_item_count="$(docker exec "$target_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM item')"
target_user_count="$(docker exec "$target_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM app_user')"
target_migration_count="$(docker exec "$target_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command 'SELECT count(*) FROM flyway_schema_history')"
target_marker_count="$(docker exec "$target_container" psql --username "$database_owner" --dbname "$database_name" --tuples-only --no-align --command "SELECT count(*) FROM item WHERE name = 'Recovery rehearsal marker' AND quantity = 42")"

if [[ "$source_item_count" != "$target_item_count" || "$source_user_count" != "$target_user_count" || "$source_migration_count" != "$target_migration_count" || "$target_marker_count" != 1 ]]; then
  printf 'Restored database did not preserve application data or migration history.\n' >&2
  exit 1
fi

target_database_port="$(docker port "$target_container" 5432/tcp | awk -F: 'END { print $NF }')"
application_pid=''
start_application "$target_database_port" "$target_app_port" prod,dev "$rehearsal_dir/target-app.log"
target_app_pid="$application_pid"
wait_for_application "$target_app_port" "$rehearsal_dir/target-app.log"

printf 'Database recovery rehearsal passed: PostgreSQL 17 backup restored on PostgreSQL 18, %s items, %s users, %s migrations, and production readiness verified.\n' \
  "$target_item_count" "$target_user_count" "$target_migration_count"
