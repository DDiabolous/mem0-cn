# Mem0 CN

简体中文 | [English](README.en.md)

基于 [Mem0](https://github.com/mem0ai/mem0) 的国产模型服务与私有化部署适配版本。目前已增加阿里云百炼 DashScope 的聊天、Embedding 和原生重排 provider，并完善 Web 模型配置与部署配置管理。

底层记忆引擎及多数集成来自上游 Mem0。本仓库的定制 provider 随本地 Python SDK 和 Docker 镜像一起构建，直接安装上游 PyPI 的 `mem0ai` 不包含这些修改。

## 本仓库的适配内容

- **统一接入 DashScope**：聊天、Embedding、重排共用 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL`。
- **原生重排接口**：支持 `qwen3.7-text-rerank`，设置调用超时，失败时回退到原检索顺序。
- **Web 模型配置**：可选择 provider、填写模型名、覆盖 API Key，以及配置或关闭重排。DashScope 的 Base URL 在服务端配置。
- **中英文界面切换**：右上角开关临时切换中英文；设置／外观中可保存语言偏好，默认跟随系统。

- **复用 PostgreSQL + pgvector**：连接已有数据库，当前服务端默认使用 1024 维向量。
- **部署信息分离**：账号、密码、密钥及真实服务地址放在 `.env`；仅这些信息支持安全默认值和 `.env` 覆盖。端口、镜像、模型及开关等普通配置直接放在 Compose。
- **Python 国内源**：服务端 Dockerfile 使用清华 PyPI 镜像；Docker 基础镜像仍从所配置的镜像仓库获取。

当前新增适配集中在阿里云百炼，不代表已完成所有国产模型、数据库、操作系统或硬件平台的兼容验证。

## 环境要求

- Docker Engine 或 Docker Desktop，以及 Docker Compose。
- PostgreSQL + pgvector：默认由 Compose 启动，也可复用现有实例。
- 阿里云百炼 API Key，以及对应业务空间、地域的接口地址。

默认 Compose 与上游一样启动 Mem0 API、PostgreSQL 和 Web 管理界面。连接宿主机现有数据库使用独立的 `server/docker-compose.host-db.yaml`，两种方式见下文。

## 快速部署

### 1. 获取代码并准备配置

```bash
git clone https://github.com/DDiabolous/mem0-cn.git
cd mem0-cn/server
cp .env.example .env
```

### 2. 选择数据库方式（二选一）

| 项目            | 方式一：Compose 启动数据库（默认，与上游一致） | 方式二：连接宿主机现有数据库                                  |
|-----------------|------------------------------------------------|---------------------------------------------------------------|
| Compose 文件    | `docker-compose.yaml`                          | `docker-compose.host-db.yaml`                                 |
| 启动服务        | API、PostgreSQL、Web                           | API、Web，不创建数据库容器                                    |
| 启动命令        | `docker compose up -d --build`                 | `docker compose -f docker-compose.host-db.yaml up -d --build` |
| `POSTGRES_HOST` | `postgres`（服务名）                           | `host.docker.internal`                                        |
| `POSTGRES_PORT` | `5432`（数据库容器内部端口）                   | 现有 PostgreSQL 的监听端口                                    |
| 数据位置        | Docker 命名卷 `postgres_db`                    | 现有 PostgreSQL 的数据目录                                    |
| 数据库准备      | 首次启动自动建库并启用 vector                  | 管理员在现有实例中建库并启用 vector                           |

真实数据库地址、账号和密码放在 `.env`，其中地址可覆盖 Compose 的安全默认值。数据库端口、数据库名和集合名是普通配置，直接修改所选 Compose。`POSTGRES_DB` 保存记忆和向量，`APP_DB_NAME` 保存账号、API Key 和运行配置。

#### 方式一：默认 Compose，自动启动 PostgreSQL

默认配置保持上游的三个服务、`postgres_db` 卷和初始化脚本结构。API 等待 PostgreSQL 健康后运行迁移，首次部署不需要手动建库。

在 `server/.env` 中设置：

```dotenv
POSTGRES_HOST=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=REPLACE_WITH_NEW_DB_PASSWORD
```

镜像、共享内存和宿主机映射端口直接修改 Compose 固定值：

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    shm_size: 128mb
    ports:
      - "8432:5432"
```

以上是配置摘录，不替换整个文件。默认部署中，API 与 PostgreSQL 的 `POSTGRES_DB=postgres`、`APP_DB_NAME=mem0_app` 应同步修改。镜像包含 PostgreSQL 17 和 pgvector，无需另拉普通 `postgres` 镜像，见 [pgvector 官方说明](https://github.com/pgvector/pgvector#docker)。账号和密码必须在 `.env` 中填写，Compose 不保存真实凭据。

- 首次启动空卷时，镜像创建 `POSTGRES_USER` 和 `POSTGRES_DB`；`init-db.sh` 根据 `APP_DB_NAME` 创建应用数据库，并在记忆数据库中启用 vector。
- 宿主机工具默认连接 `8432`，Mem0 容器连接 `postgres:5432`。若宿主机端口被占用，修改 Compose 端口映射左侧数字，API 的 `POSTGRES_PORT=5432` 保持不变。
- 数据保存在 `postgres_db`，重建容器不会清空；`docker compose down -v` 会删除该卷中的数据。
- 已初始化的卷不会因修改 `.env` 或 Compose 而自动改密码、重新建库或启用扩展。保持配置与卷一致，必要时通过 SQL 调整。不要把其他 PostgreSQL 大版本的数据目录直接挂到 PostgreSQL 17，需先备份和迁移。

已有卷缺少应用数据库或扩展时，确认连接信息后可重复执行初始化脚本：

```bash
docker compose exec -T postgres bash /docker-entrypoint-initdb.d/init-db.sh
```

#### 方式二：复用宿主机现有 PostgreSQL

使用独立的 `server/docker-compose.host-db.yaml`。该配置仅启动 API 和 Web，带有 `host.docker.internal:host-gateway` 映射，没有 PostgreSQL 服务或启动依赖。

以管理员身份连接已有数据库，仅执行尚未创建的用户和数据库语句：

```sql
CREATE ROLE mem0 LOGIN PASSWORD 'REPLACE_WITH_DB_PASSWORD';
CREATE DATABASE mem0 OWNER mem0;
CREATE DATABASE mem0_app OWNER mem0;

\connect mem0
CREATE EXTENSION IF NOT EXISTS vector;
```

应用角色需要创建表、索引和运行迁移的权限。在 `.env` 填写实际值：

```dotenv
POSTGRES_HOST=host.docker.internal
POSTGRES_USER=mem0
POSTGRES_PASSWORD=REPLACE_WITH_DB_PASSWORD
```

API 的 `POSTGRES_PORT=5432`、`POSTGRES_DB=mem0`、`POSTGRES_COLLECTION_NAME=memories` 和 `APP_DB_NAME=mem0_app` 直接在宿主机数据库 Compose 文件中按实际情况修改。此方式没有数据库容器配置。修改 `.env` 不会修改数据库的实际密码。

容器中的 `localhost` 是容器本身，宿主机 PostgreSQL 还需允许容器连接：

1. 用 `SHOW config_file;`、`SHOW hba_file;` 找到实际配置文件。
2. 将 `postgresql.conf` 的 `listen_addresses` 设为容器可访问的地址；使用 `'*'` 时，配合防火墙和 `pg_hba.conf` 限制范围。仅监听 `127.0.0.1` 无法通过宿主机网关连接。
3. 在 `pg_hba.conf` 允许实际容器来源网段访问两个数据库。将下面的 `DOCKER_SUBNET` 替换为实际 CIDR：

```text
host  mem0      mem0  DOCKER_SUBNET  scram-sha-256
host  mem0_app  mem0  DOCKER_SUBNET  scram-sha-256
```

网络创建后可查询网段；Docker Desktop 可能有额外 NAT，应以 PostgreSQL 实际看到的来源地址为准：

```bash
docker network inspect mem0-dev_mem0_network \
  --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

修改监听地址后重启 PostgreSQL；只改认证规则时，可由管理员执行 `SELECT pg_reload_conf();`。

切换部署方式前，确认 `.env` 中数据库地址与所选方式一致。两种方式不会自动迁移彼此的记忆、账号和配置，应先备份，且不要用 `down -v` 清理原数据。

### 3. 配置存放规则

| 存放位置          | 配置内容                                                                                      | 修改方式                                     |
|-------------------|-----------------------------------------------------------------------------------------------|----------------------------------------------|
| `.env`            | 数据库账号/密码、API Key、JWT Secret、实际数据库地址、模型业务空间地址、API/Web 公开地址      | 修改 Compose 或 .env 中的对应值，.env 优先   |
| 所选 Compose 文件 | 镜像、端口、数据库名、集合名、模型/provider、重排、遥测、日志保留天数、内部服务地址等通用配置 | 直接修改 Compose 中的值                      |

`server/.env` 示例：

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

连接宿主机数据库时，修改 `POSTGRES_HOST` 和账号密码。用 `openssl rand -hex 48` 生成 `JWT_SECRET`。百炼地址和 API Key 应属于同一业务空间及地域；地址支持主机根地址、`/api/v1` 和 `/compatible-mode/v1`。

只有实际地址等部署信息使用 `${变量名:-安全默认值}`。普通参数直接写固定值，例如：

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

以上是配置摘录，保留文件中其余内容。地址未设置或为空时使用安全默认值；账号密码使用 `${变量名:?提示}`，必须填写。运行命令所在 Shell 的同名环境变量按 Compose 标准规则优先于 `.env`。

远程访问或使用 Nginx 时，在 `.env` 中设置 `DASHBOARD_URL` 和 `PUBLIC_API_URL`。前者是 Web 的公开源地址，API 和 Web 共用，需与浏览器的协议、主机和端口一致；后者自动注入 Web 的 `NEXT_PUBLIC_API_URL`。真实地址不要复制到 Compose 或文档。

端口直接修改 Compose 的 `ports` 左侧数字，右侧容器端口通常不变；反向代理公开端口可以与宿主机端口不同。内部地址 `API_INTERNAL_URL=http://mem0:8000` 保持 Compose 固定值。

旧 `.env` 中若仍有 `MEM0_API_PORT`、`MEM0_DASHBOARD_PORT`、`POSTGRES_HOST_PORT`、`POSTGRES_IMAGE`、数据库名或模型/功能开关，请将这些非敏感设置迁入所选 Compose 后从 `.env` 删除。它们不再覆盖固定的 Compose 配置。例如要保留重排启用状态，应在 Compose 中将 `MEM0_RERANK_ENABLED` 改为 `true`，而不是继续写在 `.env`。

### 4. 构建并启动

完成 `.env` 中的真实地址和凭据，并按需修改 Compose 普通配置后，在 `server/` 目录执行。

方式一（默认）：可先单独拉取数据库镜像，再按上游习惯启动全部三个服务：

```bash
docker compose pull postgres
docker compose up -d --build
```

也可使用上游的 `make up` 启动流程（默认服务端口）。数据库首次初始化由容器自动完成。

方式二（连接宿主机数据库）：只使用独立文件，不会拉取或启动 PostgreSQL 容器：

```bash
docker compose -f docker-compose.host-db.yaml up -d --build
```

后续查看日志、更新或停止方式二的部署时，仍需指定 `-f docker-compose.host-db.yaml`：

```bash
docker compose -f docker-compose.host-db.yaml logs -f --tail=100 mem0
docker compose -f docker-compose.host-db.yaml down
```

默认本机访问地址：

| 服务 | 地址 |
| --- | --- |
| Web 管理界面 | http://localhost:3000 |
| REST API | http://localhost:8888 |
| 接口文档 | http://localhost:8888/docs |

打开管理界面，创建首个管理员账号，再创建 Mem0 API Key。**Mem0 API Key 用于业务应用访问记忆服务；百炼 API Key 用于服务端调用模型，两者不同。**

## 写入和查询记忆

一次写入可以包含多条消息：

```bash
export MEM0_API_KEY='YOUR_MEM0_API_KEY'

curl -sS http://localhost:8888/memories \
  -H "X-API-Key: $MEM0_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "user-001",
    "agent_id": "device-001",
    "messages": [
      {"role": "user", "content": "我喜欢科幻电影。"},
      {"role": "user", "content": "我主要使用 Python 开发。"}
    ]
  }'
```

按同一用户、同一设备、同一段连续对话分组，保持消息顺序。模型会综合提取事实，并不保证一条消息对应一条记忆。将设备 ID 用作 `agent_id` 时，每次写入和查询都应同时传入用户 ID 和设备 ID。

开启重排的查询：

```bash
curl -sS http://localhost:8888/search \
  -H "X-API-Key: $MEM0_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "用户主要使用什么开发语言？",
    "filters": {"user_id": "user-001", "agent_id": "device-001"},
    "rerank": true,
    "candidate_k": 20,
    "top_k": 5,
    "threshold": 0.2
  }'
```

| 参数 | 含义 |
| --- | --- |
| `rerank` | 本次查询是否使用已配置的重排模型，默认 `false`。 |
| `candidate_k` | 重排前召回的候选数量，范围 1～100，必须开启重排且不小于 `top_k`。 |
| `top_k` | 最终最多返回多少条记忆。 |
| `threshold` | 重排前的检索分数阈值，不是 `rerank_score` 的阈值。 |

不启用重排、最多返回 5 条时，设置 `rerank=false`、`top_k=5`，不要传 `candidate_k`。符合过滤条件和阈值的记忆不足时，实际返回条数可能更少。

重排成功后增加 `rerank_score`，保留记忆 ID、元数据和原检索分数。重排失败时回退到原检索顺序并记录警告。重排会增加延迟与模型用量，不能找回召回阶段已经排除的记忆。

## Web 配置与提取提示词

页面右上角的左右开关支持临时切换语言和日夜主题，切换时保留尚未保存的表单输入。
临时选择在刷新后保留，退出、重新登录或注册完成后恢复设置／外观中的默认偏好。
界面语言影响菜单、表单文案和日期显示，不会翻译记忆原文，也不会修改模型名称、
用户与设备 ID 或 API 请求数据。新增翻译可编辑
`server/dashboard/src/lib/i18n/messages.ts`，在客户端组件中通过 `useLanguage()` 使用；
未翻译的文案会回退到英文。

设置／外观中可分别保存语言（简体中文、English、跟随系统）和主题（日间、夜间、
跟随系统），更改后立即生效。二者默认均跟随系统，偏好保存在当前浏览器，
不跨设备或浏览器同步。右上角的临时切换不会覆盖这些偏好。

默认 V3 记忆提取使用原版系统提示词，位于 `mem0/configs/prompts.py` 中的
`ADDITIVE_EXTRACTION_PROMPT`。如需记忆正文使用简体中文，可通过
`custom_instructions` 或写入请求的 `prompt` 明确指定；已有记忆不会自动翻译。

在 **Configuration** 页面中，为聊天、Embedding 和重排选择 `dashscope`。API Key 输入框是可选覆盖值，留空时保留已保存的密钥或使用服务端环境变量。Base URL 统一从 `DASHSCOPE_BASE_URL` 读取，页面保存时会清除旧的 DashScope URL 覆盖值。

重排选择 **Disabled** 可以关闭已配置的重排模型。仅配置模型不会自动对所有搜索重排，业务请求仍需传入 `rerank=true`。

数据库保存的配置优先于环境默认值，重启后继续生效。旧部署如果使用 `openai` 兼容方式，应在页面中重新选择 `dashscope` 并保存。

使用管理员 API Key 调用 `POST /configure`，可以设置全局提取规则：

```json
{
  "custom_instructions": "只记录用户明确表达或确认的事实和长期偏好。记忆正文使用简体中文，每条记忆表达一个独立事实。不要将助手建议当作用户事实。"
}
```

`custom_instructions` 位于配置最外层。写入请求中的 `prompt` 会覆盖本次请求的全局规则；`infer=false` 时直接保存原文，不执行模型提取。修改提示词不会自动重写已有记忆。

## 更新与运维

下面命令适用于默认方式；连接宿主机数据库时，在 `docker compose` 后加上
`-f docker-compose.host-db.yaml`。

更新本仓库代码后，重新构建两个服务：

```bash
cd server
docker compose build mem0 mem0-dashboard
docker compose up -d --force-recreate mem0 mem0-dashboard
docker compose logs -f --tail=100 mem0
```

API 使用 `server/dev.Dockerfile`，以仓库根目录为构建上下文，将本地修改的 SDK 安装到 `/opt/mem0`。Web 使用单独的 Dockerfile，前端修改也需要重新构建。当前 Compose 使用 Uvicorn 热重载模式，正式部署时需按运行环境调整。

不要提交 `.env`、API Key、密码、数据库备份及 `server/history/`。真实部署信息不会随 Git 推送，服务器上的 `.env` 需要单独维护；Compose 中保留可提交的通用默认值。备份应包含 PostgreSQL 和历史目录；更换 Embedding 模型或维度时，需要检查集合兼容性，并按需重新向量化旧数据。

## 文档与上游

- [English README](README.en.md)
- [DashScope 模型与重排接入](docs/integrations/dashscope-rerank.mdx)
- [服务端参考说明](server/README.md)，包含上游历史迁移说明
- [环境变量模板](server/.env.example)
- [上游 Mem0](https://github.com/mem0ai/mem0) 与 [官方文档](https://docs.mem0.ai)

## 许可证

本仓库保留上游的 [Apache License 2.0](LICENSE)。Mem0 记忆引擎与上游功能的贡献归原项目及其贡献者所有。
