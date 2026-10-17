#!/bin/bash
set -eu

# Create the memory database and the account/config database if they are absent.
# Run as separate psql commands because CREATE DATABASE cannot run inside a
# transaction block. psql variables quote custom names safely as SQL literals.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=memory_db="${MEMORY_DB_NAME:-mem0}" \
    --set=app_db="${APP_DB_NAME:-mem0_app}" <<'SQL'
SELECT format('CREATE DATABASE %I', :'memory_db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'memory_db')
\gexec

SELECT format('CREATE DATABASE %I', :'app_db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db')
\gexec
SQL

# The vector extension belongs in the memory database where vectors are stored.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${MEMORY_DB_NAME:-mem0}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
SQL
