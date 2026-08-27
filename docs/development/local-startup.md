# Liuyao Local Startup Guide

Last reviewed: 2026-08-25

## Runtime Shape

The public Web, API, Admin, and Worker run as local Node.js processes. Docker Compose provides only:

- PostgreSQL 16;
- Redis 7.

The Six infrastructure is isolated with these identifiers:

| Resource | Six value |
| --- | --- |
| Compose project | `six` |
| PostgreSQL container | `six-postgres` |
| PostgreSQL host port | `5434` |
| PostgreSQL database | `six_professional` |
| Redis container | `six-redis` |
| Redis host port | `6381` |
| PostgreSQL volume | `six_postgres_data` under the `six` Compose project |
| API port used by this guide | `4100` |
| Web port used by this guide | `3200` |

Other projects can run at the same time when they use different container names and host ports. Container-internal ports such as PostgreSQL `5432` and Redis `6379` may be identical because each container has its own network namespace.

## Prerequisites

- Node.js 20 or the repository-supported Node.js version;
- `pnpm@9.15.4`;
- Docker Desktop when using full persistence and queues.

Install workspace dependencies once:

```bash
cd /Users/goterra/Documents/Six
pnpm install
```

## Quick UI Mode

Use this mode to inspect the homepage, Liuyao workbench, reports, and Learn Hub without starting Docker. The API uses its development fallback stores; queued Worker jobs and production readiness are not available. AI interpretation stays unavailable until a live provider is configured, and no simulated interpretation is generated.

Terminal 1, API:

```bash
cd /Users/goterra/Documents/Six
API_PORT=4100 AI_PROVIDER=disabled pnpm run dev:api
```

Terminal 2, Web:

```bash
cd /Users/goterra/Documents/Six
PORT=3200 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100/api/v1 pnpm run dev:web
```

Open `http://localhost:3200`.

### Real DeepSeek Mode

For persistent local use, place the live-provider settings in the repository-root `.env`. The file is ignored by Git, and the API and Worker development commands load it automatically. Do not place the key in source files, `.env.example`, screenshots, or logs.

```bash
cd /Users/goterra/Documents/Six
cp .env.example .env
# Fill DEEPSEEK_API_KEY in .env, then start normally.
pnpm run dev:api
```

Start the Web app in a second terminal with the Quick UI command above. Run the five-scenario live check with:

```bash
AI_PROVIDER=deepseek AI_MODEL=deepseek-v4-flash pnpm run smoke:ai:live
```

The deterministic report remains readable when the provider is unavailable or its output fails validation. The interface explicitly marks AI interpretation as unavailable and does not substitute simulated interpretation.

## Full Local Mode

Use this mode for persistent reports/settings/content, Redis queues, database migrations, and Worker-backed AI jobs.

### 1. Start isolated infrastructure

```bash
cd /Users/goterra/Documents/Six
docker compose -p six up -d
docker compose -p six ps
```

Expected host connections:

```text
PostgreSQL: postgresql://postgres:postgres@localhost:5434/six_professional
Redis:      redis://localhost:6381
```

### 2. Initialize the database

Run this after the first infrastructure start and whenever a new migration is added:

```bash
cd /Users/goterra/Documents/Six
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional pnpm db:generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional pnpm db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional pnpm db:seed
```

`db:seed` is required only for first initialization or an intentional seed refresh. It does not need to run before every development session.

### 3. Start the API

Terminal 1:

```bash
cd /Users/goterra/Documents/Six
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional \
REDIS_URL=redis://localhost:6381 \
API_PORT=4100 \
AI_PROVIDER=deepseek \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
pnpm run dev:api
```

### 4. Start the Web app

Terminal 2:

```bash
cd /Users/goterra/Documents/Six
PORT=3200 \
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100/api/v1 \
pnpm run dev:web
```

### 5. Start the Worker when queue jobs are needed

Terminal 3:

```bash
cd /Users/goterra/Documents/Six
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/six_professional \
REDIS_URL=redis://localhost:6381 \
AI_PROVIDER=deepseek \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
pnpm run dev:worker
```

The Worker is optional for synchronous local report generation. It is required for BullMQ-backed AI report jobs.

### 6. Optional Admin shell

```bash
cd /Users/goterra/Documents/Six
PORT=3201 pnpm run dev:admin
```

## URLs And Checks

| Surface | URL |
| --- | --- |
| Public Web | `http://localhost:3200` |
| API health | `http://localhost:4100/api/v1/health` |
| API readiness | `http://localhost:4100/api/v1/ready` |
| Admin when started | `http://localhost:3201` |

Quick terminal checks:

```bash
curl -s http://localhost:4100/api/v1/health
curl -s http://localhost:4100/api/v1/ready
```

In beta/production mode, `/ready` must return HTTP 503 when required PostgreSQL or Redis dependencies are unavailable. This is expected protection, not an instruction to bypass readiness.

## Docker Isolation And Conflicts

Always include the explicit project name:

```bash
docker compose -p six up -d
docker compose -p six ps
docker compose -p six down
```

Before starting, optional conflict checks are:

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
lsof -nP -iTCP:5434 -sTCP:LISTEN
lsof -nP -iTCP:6381 -sTCP:LISTEN
lsof -nP -iTCP:4100 -sTCP:LISTEN
lsof -nP -iTCP:3200 -sTCP:LISTEN
```

A conflict exists only when another running process already binds one of the host ports, or another container already owns `six-postgres` or `six-redis`. Do not change a database URL to point at another project's PostgreSQL merely to work around a port conflict.

## Stop And Restart

Stop Web/API/Worker processes with `Ctrl+C` in their terminals. Stop Docker infrastructure without deleting data:

```bash
cd /Users/goterra/Documents/Six
docker compose -p six down
```

Restart only the infrastructure:

```bash
docker compose -p six restart
```

Do not use the following command during normal development:

```bash
docker compose -p six down -v
```

The `-v` option deletes the Six PostgreSQL data volume. Use it only when an intentional full database reset has been approved.

## Common Problems

### Web shows an API connection error

- Confirm the API terminal is running on port `4100`.
- Confirm `NEXT_PUBLIC_API_BASE_URL` is exactly `http://127.0.0.1:4100/api/v1`.
- Restart the Web process after changing `NEXT_PUBLIC_API_BASE_URL`.

### API starts but readiness fails

- Run `docker compose -p six ps`.
- Confirm `DATABASE_URL` points to port `5434` and `REDIS_URL` points to port `6381`.
- Confirm both Compose health checks are healthy.

### A container name is already in use

Inspect the owner before taking action:

```bash
docker ps -a --filter name=six-postgres
docker ps -a --filter name=six-redis
```

Do not delete an unfamiliar container until its project ownership and data requirements are understood.

### A host port is already in use

Stop the owning process, or choose a coordinated alternative host port and update both `docker-compose.yml` and the corresponding connection URL. Changing only one side will make the API connect to the wrong service or fail to connect.
