# Mem0 CN

简体中文 | [English](README.en.md)

基于 [Mem0](https://github.com/mem0ai/mem0) 的国产模型服务与私有化部署适配版本。目前已增加阿里云百炼 DashScope 的聊天、Embedding 和原生重排 provider，并完善 Web 模型配置与部署配置管理。

底层记忆引擎及多数集成来自上游 Mem0。本仓库的定制 provider 随本地 Python SDK 和 Docker 镜像一起构建，直接安装上游 PyPI 的 `mem0ai` 不包含这些修改。

## 本仓库的适配内容

- **统一接入 DashScope**：聊天、Embedding、重排共用 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL`。
- **原生重排接口**：支持 `qwen3.7-text-rerank`，设置调用超时，失败时回退到原检索顺序。
- **Web 模型配置**：可选择 provider、填写模型名、覆盖 API Key，以及配置或关闭重排。DashScope 的 Base URL 在服务端配置。
- **中英文界面切换**：右上角开关临时切换中英文；设置／外观中可保存语言偏好，默认跟随系统。
- **用户和设备区分**：可约定 `user_id` 为用户 ID、`agent_id` 为设备 ID，写入和查询都传入两个标识。
- **复用 PostgreSQL + pgvector**：连接已有数据库，当前服务端默认使用 1024 维向量。
- **个人配置分离**：外部地址、宿主机端口、模型密钥和数据库配置存放在 `.env`，Git 与 Docker 构建排除本地环境文件和运行历史。
- **Python 国内源**：服务端 Dockerfile 使用清华 PyPI 镜像；Docker 基础镜像仍从所配置的镜像仓库获取。

当前新增适配集中在阿里云百炼，不代表已完成所有国产模型、数据库、操作系统或硬件平台的兼容验证。

## 环境要求

- Docker Engine 或 Docker Desktop，以及 Docker Compose。
- 已安装 pgvector 的 PostgreSQL 实例。
- 阿里云百炼 API Key，以及对应业务空间、地域的接口地址。

当前 Compose 只启动 Mem0 API 和 Web 管理界面，**不会自动创建 PostgreSQL 服务**。

## 快速部署

### 1. 获取代码并准备配置

```bash
git clone https://github.com/DDiabolous/mem0-cn.git
cd mem0-cn/server
cp .env.example .env
```

### 2. 准备数据库

使用 PostgreSQL 管理员连接数据库。如果以下用户或数据库已经存在，跳过对应创建语句：

```sql
CREATE ROLE mem0 LOGIN PASSWORD 'REPLACE_WITH_DB_PASSWORD';
CREATE DATABASE mem0 OWNER mem0;
CREATE DATABASE mem0_app OWNER mem0;

\connect mem0
CREATE EXTENSION IF NOT EXISTS vector;
```

- `mem0`：保存记忆、向量及元数据。
- `mem0_app`：保存管理账号、API Key 和运行配置。

应用数据库用户需要具备创建表、索引及运行迁移的权限。`vector` 扩展必须在实际存储记忆的数据库中启用。

如果 PostgreSQL 运行在 Docker 宿主机，设置 `POSTGRES_HOST=host.docker.internal`。PostgreSQL 需要监听容器可访问的地址，并在 `pg_hba.conf` 中允许实际 Docker 网段连接；仅监听本机回环地址时，容器无法通过宿主机网关连接。

### 3. 编辑 `server/.env`

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

使用 `openssl rand -hex 48` 生成随机字符串，填入 `JWT_SECRET`。替换示例中的密钥、密码和 `YOUR_WORKSPACE`，API Key 与地址需要属于同一业务空间及地域。

`DASHSCOPE_BASE_URL` 支持主机根地址、`/api/v1` 或 `/compatible-mode/v1`，provider 会为不同模型自动选择对应接口。

远程访问时，两个公开 URL 应改成浏览器实际可访问的地址：

| 配置项 | 用途 |
| --- | --- |
| `DASHBOARD_URL` | 浏览器访问管理界面的源地址，同时用于 CORS 校验，协议、主机和端口必须匹配。 |
| `PUBLIC_API_URL` | 浏览器请求 Mem0 API 的地址。 |
| `MEM0_DASHBOARD_PORT` | Web 容器映射到宿主机的端口。 |
| `MEM0_API_PORT` | API 容器映射到宿主机的端口。 |

使用 Nginx 时，公开 URL 填反向代理后的地址，宿主机端口可保持原值。远程浏览器中的 `localhost` 指访问者自己的电脑，不能用它代替服务器地址。

### 4. 构建并启动

在 `server/` 目录执行：

```bash
docker compose build mem0 mem0-dashboard
docker compose up -d
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

更新本仓库代码后，重新构建两个服务：

```bash
cd server
docker compose build mem0 mem0-dashboard
docker compose up -d --force-recreate mem0 mem0-dashboard
docker compose logs -f --tail=100 mem0
```

API 使用 `server/dev.Dockerfile`，以仓库根目录为构建上下文，将本地修改的 SDK 安装到 `/opt/mem0`。Web 使用单独的 Dockerfile，前端修改也需要重新构建。当前 Compose 使用 Uvicorn 热重载模式，正式部署时需按运行环境调整。

不要提交 `.env`、API Key、密码、数据库备份及 `server/history/`。个人配置不会随 Git 推送，服务器上的 `.env` 需要单独维护。备份应包含 PostgreSQL 和历史目录；更换 Embedding 模型或维度时，需要检查集合兼容性，并按需重新向量化旧数据。

## 文档与上游

- [English README](README.en.md)
- [DashScope 模型与重排接入](docs/integrations/dashscope-rerank.mdx)
- [服务端参考说明](server/README.md)，包含上游历史迁移说明
- [环境变量模板](server/.env.example)
- [上游 Mem0](https://github.com/mem0ai/mem0) 与 [官方文档](https://docs.mem0.ai)

## 许可证

本仓库保留上游的 [Apache License 2.0](LICENSE)。Mem0 记忆引擎与上游功能的贡献归原项目及其贡献者所有。
