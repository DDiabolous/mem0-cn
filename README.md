# Mem0 CN

[简体中文](README.zh-CN.md) | English

A fork of [Mem0](https://github.com/mem0ai/mem0) for adapting Chinese model services and self-hosted deployments. This fork currently adds Alibaba Cloud DashScope providers for chat, embeddings, and reranking, together with dashboard configuration and deployment improvements.

The underlying memory engine and most integrations come from upstream Mem0. Fork-specific providers are included in this repository's Python SDK and Docker build; installing the upstream `mem0ai` package alone does not include these changes.

## What this fork adds

- **Unified DashScope configuration:** chat, embeddings, and reranking share `DASHSCOPE_API_KEY` and `DASHSCOPE_BASE_URL`.
- **Native text reranking:** supports `qwen3.7-text-rerank`, with timeout handling and fallback to retrieval order.
- **Dashboard model settings:** configure providers, model names, and optional API key overrides; configure or disable reranking. DashScope's base URL is managed on the server.
- **User and device scoping:** use `user_id` for users and `agent_id` for devices in both writes and searches.
- **PostgreSQL + pgvector:** reuse an existing database, with a 1024-dimensional embedding configuration in the current server defaults.
- **Deployment configuration:** keep public URLs, host ports, credentials, and database settings in `.env`. Git and Docker ignore local environment files and runtime history.
- **Python package mirror:** server Dockerfiles use the Tsinghua PyPI mirror. Docker base images still come from their configured registries.

Only DashScope-specific additions are described here; this is not a claim of compatibility with every Chinese model provider or domestic hardware platform.

## Requirements

- Docker Engine or Docker Desktop with Docker Compose.
- An existing PostgreSQL instance with pgvector installed.
- A DashScope API key and the base URL for its workspace and region.

The current Compose file runs the Mem0 API and dashboard. It does **not** start PostgreSQL.

## Quick start

### 1. Clone and prepare configuration

```bash
git clone https://github.com/DDiabolous/mem0-cn.git
cd mem0-cn/server
cp .env.example .env
```

### 2. Prepare PostgreSQL

Connect as a PostgreSQL administrator and create the databases if they do not already exist:

```sql
CREATE ROLE mem0 LOGIN PASSWORD 'REPLACE_WITH_DB_PASSWORD';
CREATE DATABASE mem0 OWNER mem0;
CREATE DATABASE mem0_app OWNER mem0;

\connect mem0
CREATE EXTENSION IF NOT EXISTS vector;
```

`mem0` stores vector memories. `mem0_app` stores accounts, API keys, and saved configuration. The application user must be able to create tables and indexes in these databases.

When PostgreSQL runs on the Docker host, use `POSTGRES_HOST=host.docker.internal`. PostgreSQL must listen on an address reachable from containers, and `pg_hba.conf` must allow the actual Docker subnet. A loopback-only listener is not reachable through the Docker host gateway.

### 3. Edit `server/.env`

```dotenv
DASHSCOPE_API_KEY=YOUR_DASHSCOPE_API_KEY
DASHSCOPE_BASE_URL=https://YOUR_WORKSPACE.cn-beijing.maas.aliyuncs.com/api/v1

MEM0_DEFAULT_LLM_PROVIDER=dashscope
MEM0_DEFAULT_EMBEDDER_PROVIDER=dashscope
MEM0_DEFAULT_LLM_MODEL=qwen3.6-flash
MEM0_DEFAULT_EMBEDDER_MODEL=qwen3.7-text-embedding-flash
MEM0_RERANK_ENABLED=true
MEM0_RERANK_MODEL=qwen3.7-text-rerank

POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
POSTGRES_DB=mem0
POSTGRES_USER=mem0
POSTGRES_PASSWORD=REPLACE_WITH_DB_PASSWORD
POSTGRES_COLLECTION_NAME=memories
APP_DB_NAME=mem0_app

JWT_SECRET=REPLACE_WITH_RANDOM_SECRET
AUTH_DISABLED=false
MEM0_TELEMETRY=false

DASHBOARD_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:8888
MEM0_DASHBOARD_PORT=3000
MEM0_API_PORT=8888
```

Generate a value for `JWT_SECRET` with `openssl rand -hex 48` and paste the result into `.env`.

The DashScope base URL accepts a host root, `/api/v1`, or `/compatible-mode/v1`; the provider chooses the appropriate endpoint for each model. Use the key and URL belonging to the same workspace and region.

For remote access, replace both public URLs with addresses reachable from the browser. `DASHBOARD_URL` must exactly match the dashboard origin, including scheme and port, because it also controls CORS. Behind Nginx, use the external URLs here; the Docker host ports can remain unchanged.

### 4. Build and start

From `server/`:

```bash
docker compose build mem0 mem0-dashboard
docker compose up -d
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

- [中文说明](README.zh-CN.md)
- [DashScope provider and reranking guide](docs/integrations/dashscope-rerank.mdx)
- [Server reference](server/README.md), including upstream migration notes
- [Environment template](server/.env.example)
- [Upstream Mem0](https://github.com/mem0ai/mem0) and [official documentation](https://docs.mem0.ai)

## License

This fork retains the upstream [Apache License 2.0](LICENSE). Credit for the Mem0 memory engine and upstream features belongs to the Mem0 project and its contributors.
