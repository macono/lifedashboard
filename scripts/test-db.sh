#!/usr/bin/env bash
# Tests the Supabase migration and its security rules on a throwaway local PostgreSQL.
# Needs PostgreSQL 15+ binaries (initdb, pg_ctl, psql) on PATH. Does not touch Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; RUN_AS=(su postgres -c); fi
run() { if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi; }

cleanup() { run "$PG_BIN/pg_ctl -D $DATA -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

run "$PG_BIN/initdb -D $DATA -U postgres -A trust" >/dev/null
run "$PG_BIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp -c listen_addresses=' -w start" >/dev/null

PSQL=("$PG_BIN/psql" -h /tmp -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f supabase/tests/auth-stub.sql
for f in supabase/migrations/*.sql; do echo "Applying $f"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -t -A -f supabase/tests/rls.test.sql 2>&1 | sed "s/^psql:[^ ]* NOTICE:  //" | grep -v "^$"
