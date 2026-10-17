# Mem0 CN

[简体中文](README.md) | English

A fork of [Mem0](https://github.com/mem0ai/mem0) for adapting Chinese model services and self-hosted deployments. This fork currently adds Alibaba Cloud DashScope providers for chat, embeddings, and reranking, together with dashboard configuration and deployment improvements.

The underlying memory engine and most integrations come from upstream Mem0. Fork-specific providers are included in this repository's Python SDK and Docker build; installing the upstream `mem0ai` package alone does not include these changes.

## What this fork adds

- **Unified DashScope configuration:** chat, embeddings, and reranking share `DASHSCOPE_API_KEY` and `DASHSCOPE_BASE_URL`.
- **Native text reranking:** supports `qwen3.7-text-rerank`, with timeout handling and fallback to retrieval order.
- **Dashboard model settings:** configure providers, model names, and optional API key overrides; configure or disable reranking. DashScope's base URL is managed on the server.
- **Bilingual dashboard:** top-right switches temporarily change language and theme; Settings → Appearance saves defaults, initially following the system.
- **User and device scoping:** use `user_id` for users and `agent_id` for devices in both writes and searches.
- **PostgreSQL + pgvector:** reuse an existing database, with a 1024-dimensional embedding configuration in the current server defaults.
- **Deployment configuration:** keep credentials and real endpoints in `.env`; only these support safe Compose fallbacks and `.env` overrides. Edit ordinary ports, images, models, and flags directly in Compose. Git and Docker ignore local environment files and runtime history.
- **Python package mirror:** server Dockerfiles use the Tsinghua PyPI mirror. Docker base images still come from their configured registries.

Only DashScope-specific additions are described here; this is not a claim of compatibility with every Chinese model provider or domestic hardware platform.

## Requirements

- Docker Engine or Docker Desktop with Docker Compose.
- PostgreSQL with pgvector: started by Compose by default, or reuse an existing instance.
- A DashScope API key and the base URL for its workspace and region.

The default Compose file starts the API, PostgreSQL, and dashboard, matching upstream. Use the standalone `server/docker-compose.host-db.yaml` to connect to an existing host database instead.

## Quick start

### 1. Clone and prepare configuration

```bash
git clone https://github.com/DDiabolous/mem0-cn.git
cd mem0-cn/server
cp .env.example .env
```

### 2. Choose a database method

| Setting | Method A: Compose database (default, matching upstream) | Method B: existing host database |
| --- | --- | --- |
| Compose file | `docker-compose.yaml` | `docker-compose.host-db.yaml` (standalone) |
| Services | API, PostgreSQL, dashboard | API and dashboard only |
| Startup | `docker compose up -d --build` | `docker compose -f docker-compose.host-db.yaml up -d --build` |
| `POSTGRES_HOST` | `postgres` (service name) | `host.docker.internal` |
| `POSTGRES_PORT` | `5432` (internal database port) | Existing server port |
| Persistence | Named volume `postgres_db` | Existing database directory |
| Initialization | Automatic databases and vector extension | Administrator prepares the existing instance |

Keep actual database hosts and credentials in `.env`; hosts override safe Compose fallbacks. Ports, database names, and collection names are ordinary settings edited directly in Compose. `POSTGRES_DB` stores memories and vectors; `APP_DB_NAME` stores accounts, API keys, and configuration.

#### Method A: default Compose with PostgreSQL

The default preserves upstream's three services, `postgres_db` volume, and initialization-script mount. The API waits for PostgreSQL health before migrations; fresh deployments require no manual database SQL.

Set `server/.env`:

```dotenv
POSTGRES_HOST=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_NEW_DB_PASSWORD
```

Edit image, shared memory, and host-port mapping directly in Compose:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    shm_size: 128mb
    ports:
      - "8432:5432"
```

This is an excerpt, not the whole file. Keep API and PostgreSQL `POSTGRES_DB=postgres` and `APP_DB_NAME=mem0_app` in sync when editing the default deployment. The image contains PostgreSQL 17 and pgvector; no separate plain `postgres` image is needed. See the [official pgvector image documentation](https://github.com/pgvector/pgvector#docker). Credentials must be supplied in `.env`, not committed to Compose.

- An empty volume's first startup creates `POSTGRES_USER` and `POSTGRES_DB`; `init-db.sh` creates `APP_DB_NAME` and enables vector in the memory database.
- Host tools use port `8432` by default; Mem0 connects to `postgres:5432`. Edit the left-side Compose port if occupied, keeping API `POSTGRES_PORT=5432`.
- Data persists in `postgres_db`; container recreation preserves it. `docker compose down -v` deletes the volume's data.
- Editing `.env` or Compose does not change passwords, create databases, or enable extensions in an initialized volume. Match its settings or adjust them with SQL. Back up and migrate before changing PostgreSQL major versions.

If an existing volume lacks the application database or extension, confirm its settings and rerun the idempotent script:

```bash
docker compose exec -T postgres bash /docker-entrypoint-initdb.d/init-db.sh
```

#### Method B: existing PostgreSQL on the host

Use `server/docker-compose.host-db.yaml` alone. It starts only the API and dashboard, adds `host.docker.internal:host-gateway`, and has no PostgreSQL service or startup dependency.

Connect as an administrator and run only statements for roles and databases that do not exist:

```sql
CREATE ROLE mem0 LOGIN PASSWORD 'REPLACE_WITH_DB_PASSWORD';
CREATE DATABASE mem0 OWNER mem0;
CREATE DATABASE mem0_app OWNER mem0;

\connect mem0
CREATE EXTENSION IF NOT EXISTS vector;
```

The role needs permissions for tables, indexes, and migrations. Put actual values in `.env`:

```dotenv
POSTGRES_HOST=host.docker.internal
POSTGRES_USER=mem0
POSTGRES_PASSWORD=REPLACE_WITH_DB_PASSWORD
```

Set API `POSTGRES_PORT=5432`, `POSTGRES_DB=mem0`, `POSTGRES_COLLECTION_NAME=memories`, and `APP_DB_NAME=mem0_app` directly in the host-database Compose file to match the existing instance. This method has no database container. Editing `.env` does not change the actual database password.

Container `localhost` means the container itself. Configure the existing PostgreSQL server to accept container connections:

1. Locate configuration with `SHOW config_file;` and `SHOW hba_file;`.
2. Set `listen_addresses` to a reachable host address. If using `'*'`, restrict firewall and `pg_hba.conf` access. Loopback-only listening is not reachable through the host gateway.
3. Allow the actual source subnet for both databases, replacing `DOCKER_SUBNET` with its CIDR:

```text
host  mem0      mem0  DOCKER_SUBNET  scram-sha-256
host  mem0_app  mem0  DOCKER_SUBNET  scram-sha-256
```

Inspect the network after creation. Docker Desktop may apply additional NAT; use the source address PostgreSQL actually sees:

```bash
docker network inspect mem0-dev_mem0_network \
  --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

Restart PostgreSQL for listener changes; authentication-rule-only changes can use `SELECT pg_reload_conf();` as an administrator.

Before switching methods, ensure `.env` selects the intended host. Switching does not migrate memories, accounts, or saved configuration. Back up first and avoid `down -v` when retaining data.

### 3. Where settings belong

| Location | Settings | How to edit |
| --- | --- | --- |
| `.env` | Database credentials, API keys, JWT secret, real database/workspace endpoints, public API/dashboard URLs | Supply actual values without committing them. Compose retains safe fallback addresses; matching non-empty `.env` values take precedence. |
| Selected Compose file | Images, ports, database/collection names, models/providers, reranking, telemetry, retention, and internal service addresses | Edit fixed values directly; these do not support `.env` overrides. |

Example `server/.env`:

```dotenv
POSTGRES_HOST=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_DB_PASSWORD
DASHSCOPE_API_KEY=YOUR_DASHSCOPE_API_KEY
DASHSCOPE_BASE_URL=https://YOUR_WORKSPACE.cn-beijing.maas.aliyuncs.com/api/v1
OPENAI_API_KEY=
ADMIN_API_KEY=
JWT_SECRET=REPLACE_WITH_RANDOM_SECRET
DASHBOARD_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8888
```

For a host database, change `POSTGRES_HOST` and credentials. Generate `JWT_SECRET` with `openssl rand -hex 48`. The DashScope key and endpoint must match workspace and region; host roots, `/api/v1`, and `/compatible-mode/v1` are supported.

Only deployment addresses use `${VARIABLE:-safe-default}`; ordinary settings use fixed values:

```yaml
services:
  mem0:
    ports:
      - "8888:8000"
    environment:
      - DASHBOARD_URL=${DASHBOARD_URL:-http://localhost:3000}
      - DASHSCOPE_BASE_URL=${DASHSCOPE_BASE_URL:-https://dashscope.aliyuncs.com/api/v1}
      - MEM0_DEFAULT_LLM_PROVIDER=dashscope
      - MEM0_DEFAULT_LLM_MODEL=qwen3.8-flash
      - MEM0_DEFAULT_EMBEDDER_MODEL=qwen3.7-text-embedding-flash
      - MEM0_RERANK_ENABLED=false
      - MEM0_RERANK_MODEL=qwen3.7-text-rerank
      - AUTH_DISABLED=false
      - MEM0_TELEMETRY=true
      - REQUEST_LOG_RETENTION_DAYS=30
  mem0-dashboard:
    ports:
      - "3000:3000"
    environment:
      - DASHBOARD_URL=${DASHBOARD_URL:-http://localhost:3000}
      - NEXT_PUBLIC_API_URL=${PUBLIC_API_URL:-http://localhost:8888}
      - API_INTERNAL_URL=http://mem0:8000
      - NEXT_PUBLIC_INSTANCE_NAME=Mem0
```

This is an excerpt; retain the rest of the file. Unset or empty addresses use fallbacks. `${VARIABLE:?message}` requires credentials. Standard Compose precedence still applies: matching shell exports override `.env`.

For remote access or Nginx, put actual `DASHBOARD_URL` and `PUBLIC_API_URL` in `.env`. The first is the public dashboard origin shared by API and Web, matching browser scheme, host, and port. The second supplies Web's `NEXT_PUBLIC_API_URL`. Do not copy actual addresses into tracked Compose files or documentation.

Change host ports on the left side of Compose `ports` mappings; normally keep container ports unchanged. Reverse proxy public ports may differ. Keep the internal `API_INTERNAL_URL=http://mem0:8000` fixed in Compose.

Move old non-sensitive `.env` settings such as `MEM0_API_PORT`, `MEM0_DASHBOARD_PORT`, `POSTGRES_HOST_PORT`, `POSTGRES_IMAGE`, database names, models, and feature flags into the selected Compose file, then remove them from `.env`. They no longer override fixed Compose values. To retain enabled reranking, for example, set `MEM0_RERANK_ENABLED=true` directly in Compose rather than `.env`.

### 4. Build and start

Finish real addresses and credentials in `.env`, and ordinary settings in Compose, then run from `server/`.

Method A (default): optionally pull the database image first, then start all three services:

```bash
docker compose pull postgres
docker compose up -d --build
```

The upstream `make up` workflow also works with the default service ports. The database initializes automatically on its first startup.

Method B (existing host database): use only the standalone file; it does not pull or start a PostgreSQL container:

```bash
docker compose -f docker-compose.host-db.yaml up -d --build
```

Keep specifying that file for Method B logs, updates, and shutdown:

```bash
docker compose -f docker-compose.host-db.yaml logs -f --tail=100 mem0
docker compose -f docker-compose.host-db.yaml down
```

| Service | Default local URL |
| --- | --- |
| Dashboard | http://localhost:3000 |
| API | http://localhost:8888 |
| OpenAPI documentation | http://localhost:8888/docs |

Open the dashboard, register the first administrator, and create an API key. The Mem0 API key authenticates your application requests; it is separate from the DashScope key used by the server.

## Write and search memories

```bash
export MEM0_API_KEY='YOUR_MEM0_API_KEY'

curl -sS http://localhost:8888/memories \
  -H "X-API-Key: $MEM0_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "user-001",
    "agent_id": "device-001",
    "messages": [
      {"role": "user", "content": "I like science fiction movies."},
      {"role": "user", "content": "I mainly develop in Python."}
    ]
  }'
```

`messages` accepts multiple messages. Group them by the same user and device, in conversation order. When using devices as `agent_id`, consistently pass both IDs to keep scopes separate.

Search with reranking:

```bash
curl -sS http://localhost:8888/search \
  -H "X-API-Key: $MEM0_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "What programming language does the user use?",
    "filters": {"user_id": "user-001", "agent_id": "device-001"},
    "rerank": true,
    "candidate_k": 20,
    "top_k": 5,
    "threshold": 0.2
  }'
```

| Parameter | Meaning |
| --- | --- |
| `rerank` | Whether this search uses the configured reranker; defaults to `false`. |
| `candidate_k` | Retrieval depth before reranking, from 1 to 100. Requires `rerank=true` and must be at least `top_k`. |
| `top_k` | Maximum number of results returned. |
| `threshold` | Minimum retrieval score **before** reranking; does not filter `rerank_score`. |

To retrieve up to five memories without reranking, set `rerank=false`, `top_k=5`, and omit `candidate_k`. Fewer results may be returned if not enough memories pass the filters and threshold.

Successful reranking adds `rerank_score` while preserving original IDs, metadata, and retrieval scores. On reranking failure, results fall back to retrieval order and a warning is logged. Reranking adds latency and model usage and cannot recover memories excluded during retrieval.

## Dashboard and extraction instructions

Use the top-right switches to temporarily change language and light/dark theme
without clearing form inputs. Overrides survive refresh and reset on logout,
login, or registration to the preferences in Settings → Appearance. This changes interface labels and date formatting, not memory text,
model names, IDs, or API payloads. To add translations, edit
`server/dashboard/src/lib/i18n/messages.ts` and use the `useLanguage()` hook in
client components. Missing translations fall back to their English source text.

Settings → Appearance saves language (Simplified Chinese, English, or system)
and theme (light, dark, or system) preferences. Both default to system and are
remembered in the current browser, without cross-device or account synchronization.
Temporary switches do not overwrite these saved preferences.

V3 extraction uses the original system prompt, `ADDITIVE_EXTRACTION_PROMPT`
in `mem0/configs/prompts.py`. To request Simplified Chinese memory text, specify
the language in `custom_instructions` or a write request's `prompt`. Existing
memories are not translated automatically.

In **Configuration**, select `dashscope` for chat, embeddings, and reranking. API key fields are optional overrides; otherwise models use the server's shared key. The base URL is read from `DASHSCOPE_BASE_URL`. Saving the page clears previous DashScope URL overrides. Select **Disabled** to remove the configured reranker.

Saved database configuration overrides environment defaults after a restart. Existing deployments using the `openai` compatibility provider should select `dashscope` and save once. Configuring a reranker does not enable it automatically for every API search: requests must still pass `rerank=true`.

Set extraction rules through the administrator-only `POST /configure` endpoint:

```json
{
  "custom_instructions": "Record only user-confirmed facts and long-term preferences. Write memory text in Simplified Chinese. Do not turn assistant suggestions into user facts."
}
```

`custom_instructions` is a top-level setting. A write request's `prompt` overrides it for that request. With `infer=false`, messages are stored directly and extraction instructions do not apply. Changing instructions does not rewrite existing memories.

## Updating and operating the deployment

The commands below use the default configuration. For Method B, add
`-f docker-compose.host-db.yaml` after `docker compose`.

After updating this fork's source, rebuild the API and dashboard:

```bash
cd server
docker compose build mem0 mem0-dashboard
docker compose up -d --force-recreate mem0 mem0-dashboard
docker compose logs -f --tail=100 mem0
```

The API build uses `server/dev.Dockerfile` with the repository root as context. It installs the local SDK under `/opt/mem0`, so the custom providers are available. The dashboard has a separate Dockerfile and must also be rebuilt after frontend changes. The current Compose stack uses Uvicorn reload mode; review its settings for your production environment.

Keep `.env`, passwords, API keys, database dumps, and `server/history/` out of commits. Back up PostgreSQL and the history directory. Changing an embedding model or dimensions requires a compatible collection and, where necessary, re-embedding existing data.

## Documentation and upstream

- [中文说明](README.md)
- [DashScope provider and reranking guide](docs/integrations/dashscope-rerank.mdx)
- [Server reference](server/README.md), including upstream migration notes
- [Environment template](server/.env.example)
- [Upstream Mem0](https://github.com/mem0ai/mem0) and [official documentation](https://docs.mem0.ai)

## License

This fork retains the upstream [Apache License 2.0](LICENSE). Credit for the Mem0 memory engine and upstream features belongs to the Mem0 project and its contributors.
