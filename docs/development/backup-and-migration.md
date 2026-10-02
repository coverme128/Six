# SIX 数据备份与迁移指南

最后更新：2026-10-02。仅适用于 SIX，不操作 OpenXA、AIBox 或其他项目。

2026-10-02 增补：报告增加匿名归属与幂等请求字段。部署前须应用 `20261002080000_report_workspace`，旧报告不会自动分配给访问者；认领方法与浏览器凭证边界见 [工作台 P0 修复记录](workbench-p0-closure.md)。本次尚未执行该数据库迁移。

本文提供后续执行步骤，不代表已经备份、迁移或配置自动任务。日常启动见 [本地启动指南](local-startup.md)。

## 1. 当前数据在哪里

| 资源 | SIX 当前配置 |
| --- | --- |
| Compose 项目 | `six` |
| PostgreSQL | `postgres:16-alpine`，容器 `six-postgres` |
| 数据库 / 数据卷 | `six_professional` / `six_postgres_data` |
| 本机 PostgreSQL 端口 | `5434` |
| Redis | 容器 `six-redis`，本机端口 `6381` |
| 队列 | BullMQ `six-report-jobs` |

2026-09-02 从已停止数据库的隔离副本查询到以下结果。源数据卷只读挂载，原库没有启动或修改；临时副本已销毁。以下是当日快照，不是以后必须固定不变的数量。

| 数据表 | 当日记录数 | 内容 |
| --- | ---: | --- |
| `content_entries` | 603 | 正文、摘要、分类、关联内容和发布状态等 JSON 内容 |
| `app_settings` | 1 | 时区、默认起卦方式、术语模式、报告语言等应用设置 |
| `reports` | 0 | 预留保存原问题、排盘 `result`、`narrative_report`、`aiReport`、`experience`、ID 和时间 |
| `anonymous_devices` | 0 | 匿名设备及报告关联 |
| `usage_events` | 0 | 使用事件 |
| `_prisma_migrations` | 1 | 已执行的数据库结构迁移 |

603 条内容包括：知识 196、FAQ 170、教程 128、六十四卦 64、术语 30、八卦 8、专题页 6、学习路径 1。2026-09-09 完成商业闭环内容刷新后，状态为 `PUBLISHED` 7、`IN_REVIEW` 493、`INTERNAL_ONLY` 88、`ARCHIVED` 15。生产内容 API 只开放 7 条 `PUBLISHED` 入口；本地开发模式可见 500 条公开或待审内容。以上状态会随逐条专业审核而变化，迁移验收必须重新查询，不能把这些数字写死为数据库约束。

当日数据库逻辑大小约 9.9 MB，卷约 67 MB。卷还包含 PostgreSQL 系统文件、WAL 等，不能用卷大小判断业务记录量。

### 报告持久化风险

- 当日根目录 `.env` 未配置 `DATABASE_URL`，数据库容器处于停止状态，`data/runtime/history.json` 不存在。
- 当前开发模式未配置数据库时使用进程内存并显示临时保存提示；beta/production 没有数据库时拒绝新建报告。配置数据库后写入失败返回错误，不再返回成功的 `memory-fallback`。页面能打开报告仍不代表已落库，须检查 `persistence=prisma` 并重启验证。
- 此库没有历史报告，备份它不能找回此前只存在于内存、已随进程退出消失的报告。浏览器截图、PDF 和展示用导出也不等同于可恢复的完整数据库备份。
- 若旧进程仍有重要内存报告，不要先重启。先保存完整报告响应和 AI 数据，安排经验证的导入；当前没有通用的一键内存报告迁移工具。

## 2. 必须一起保留的资产

| 备份对象 | 原因 |
| --- | --- |
| 整库逻辑备份 | 保留内容、设置、报告、关联关系和迁移记录 |
| `data/` | 六爻基础数据、CORE_V1 规则、知识图谱、视觉配置；若将来出现 `data/runtime/` 也要一并审查保留 |
| `content/` | 已导入内容及关联信息的文件源 |
| `public/`、`apps/web/public/` | 图片、SVG 和其他静态资源；数据库中的路径不包含文件本身 |
| `prompts/`、`apps/`、`packages/`、`scripts/` | 对应版本的 AI 提示词、引擎、渲染和运行代码 |
| Prisma schema / migrations、锁文件、Compose 与构建配置 | 重建对应环境和数据库结构 |
| Git 历史及未提交文件 | 仅记提交号不能保住未提交或未跟踪的工作 |
| 环境配置与密钥 | `.env`、部署平台配置、AI 密钥等另行加密保管，不提交 Git |

原始下载 ZIP 若仍是唯一来源，也应另外归档；项目内的备份不会自动包含 Downloads 目录。不要只备份数据库或只执行 Git clone。

`node_modules`、`.next*`、`.turbo`、构建缓存和测试临时产物可以重新生成。备份包含用户问题及业务内容，即使排除了 `.env`，也应视为敏感文件。

## 3. 迁移前确认真正落库

仅当旧内存报告已处理后，按启动指南启动 SIX PostgreSQL，并在根目录 `.env` 配置正确的 `DATABASE_URL`。本地默认连接为 `postgresql://postgres:postgres@localhost:5434/six_professional`；这个演示密码不能直接用于生产。连接到容器网络时使用数据库服务地址，不照搬本机 `localhost`。

迁移验收必须包含：

1. 正常生成一份可辨认的验证报告，读取 `GET /api/v1/reports/:id`，确认 `persistence` 是 `prisma`。
2. 查询 `reports` 表确认该 ID 存在；生成真实 AI 解读后确认该行 `aiReport` 已保存。真实调用会产生供应商费用，不用 mock 替代验收。
3. 重启 API，再访问同一个报告 ID，确认排盘及 AI 内容仍可读。
4. 数据库连接失败、`memory`、`memory-fallback` 或旧报告消失均视为验收不通过。

当前 `/health` 仅表示进程响应，`/ready` 主要检查配置是否存在，不执行真正的数据库读写探测，不能单独作为持久化验收凭据。本文没有改动这些运行行为。

## 4. 执行备份

### 4.1 准备与一致性

- 日常 PostgreSQL 逻辑备份可以在数据库运行时执行。
- 最终迁移备份应先停止新写入和入队，等待在途 AI 请求及 Worker 任务完成，再停止 API / Worker；保留 PostgreSQL 运行。不要先杀掉仍持有重要内存报告的进程。
- 同时冻结内容编辑、资产生成和代码修改，保证文件归档与数据库属于同一批次。
- 检查磁盘空间。备份目录放在仓库外；完整备份完成后另存到外置盘或另一台机器。不要直接删除或拷贝运行中的 `Docker.raw` 来替代整库备份。

以下命令用于当前本机 SIX，要求 `six-postgres` 已运行且能通过 `pg_isready`。若原库停止，先根据启动指南核对端口，再仅启动 `docker compose -p six up -d postgres`。命令不会启动其他项目。

在同一个 Bash 终端执行；任一步失败就停止，不使用未完成的 `.partial` 文件：

```bash
set -euo pipefail
umask 077
cd /Users/goterra/Documents/Six
BACKUP_ROOT="$HOME/SIX-backups"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_ROOT"
mkdir "$BACKUP_DIR"

docker inspect --format '{{.Name}} {{.State.Status}} {{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}' six-postgres
docker exec six-postgres pg_isready -U postgres -d six_professional

docker exec six-postgres pg_dump -U postgres -d six_professional \
  --format=custom --no-owner --no-privileges > "$BACKUP_DIR/database.dump.partial"
mv "$BACKUP_DIR/database.dump.partial" "$BACKUP_DIR/database.dump"
docker exec -i six-postgres pg_restore --list \
  < "$BACKUP_DIR/database.dump" > "$BACKUP_DIR/database-toc.txt"

docker exec six-postgres psql -X -U postgres -d six_professional \
  -v ON_ERROR_STOP=1 --csv -c "SELECT 'reports' AS table_name, count(*) AS rows FROM reports UNION ALL SELECT 'content_entries', count(*) FROM content_entries UNION ALL SELECT 'app_settings', count(*) FROM app_settings UNION ALL SELECT 'anonymous_devices', count(*) FROM anonymous_devices UNION ALL SELECT 'usage_events', count(*) FROM usage_events UNION ALL SELECT '_prisma_migrations', count(*) FROM _prisma_migrations ORDER BY table_name" \
  > "$BACKUP_DIR/table-counts.csv"

git rev-parse HEAD > "$BACKUP_DIR/git-commit.txt"
git status --short > "$BACKUP_DIR/git-status.txt"
git bundle create "$BACKUP_DIR/source.bundle" --all

tar --exclude='./.git' --exclude='node_modules' --exclude='.pnpm-store' \
  --exclude='.next' --exclude='.next-*' --exclude='.turbo' --exclude='dist' \
  --exclude='test-results' --exclude='playwright-report' --exclude='*.tsbuildinfo' \
  --exclude='.env' --exclude='.env.*' \
  -czf "$BACKUP_DIR/project.tar.gz.partial" .
mv "$BACKUP_DIR/project.tar.gz.partial" "$BACKUP_DIR/project.tar.gz"
tar -tzf "$BACKUP_DIR/project.tar.gz" > "$BACKUP_DIR/project-files.txt"

(
  cd "$BACKUP_DIR"
  shasum -a 256 database.dump database-toc.txt table-counts.csv source.bundle \
    project.tar.gz project-files.txt git-commit.txt git-status.txt > checksums.sha256
)
printf 'Backup directory: %s\n' "$BACKUP_DIR"
```

上述归档包括未提交和未跟踪的普通项目文件，但有意排除 `.env*`，包括 `.env.example`；模板可从 Git bundle 取回。自定义命名的密钥文件不会被自动识别，归档前应审查。环境变量中的生产密码与 API 密钥使用密码管理器或受控的加密备份，不能附到明文说明、日志或 Git 中。

`pg_dump --no-owner --no-privileges` 便于迁到专属账号，但不会迁移集群角色、密码和授权策略。生产目标需单独建立数据库 owner / 应用角色并设置最小权限；如有自定义角色和权限，还需单独记录和安全备份。

日常在线备份时，后续计数查询可能包含备份快照之后的新记录，不能要求二者强行相等。最终迁移要在冻结写入后备份并采集计数，恢复时才能精确比较。

### 4.2 Redis 队列

SIX 的 Redis 用于 BullMQ AI 任务，不是报告的最终存储。当前 Compose 没有明确声明可移植的 Redis 命名卷及持久化策略，不能认为复制 PostgreSQL 就带走了队列。

默认迁移方式：停止新入队，处理或明确取消 waiting / active / delayed 等未完成任务，记录失败任务及对应报告 ID，停 Worker，再备份 PostgreSQL。新环境使用空的独立 Redis。队列为空须按 BullMQ 任务状态核对，不能只看 Redis 键数量。

若需要保留未完成任务，应另行做停写后的 Redis RDB/AOF 备份恢复演练，保持队列名和关联报告 ID 一致。未经核对不要批量重放，避免重复 AI 调用或覆盖解读；旧新 Worker 不得同时处理同一迁移批次。

## 5. 隔离恢复演练

`pg_restore --list` 和校验和只能发现部分文件问题，不能代替实际恢复。以下在现有 PostgreSQL 实例中创建一个全新的演练库，不覆盖 `six_professional`，也不启动 API / Worker。

把 `BACKUP_DIR` 改为本次备份的绝对路径；保留在同一 Bash 终端中：

```bash
set -euo pipefail
BACKUP_DIR="$HOME/SIX-backups/REPLACE_WITH_BACKUP_TIMESTAMP"
test -f "$BACKUP_DIR/checksums.sha256"
(
  cd "$BACKUP_DIR"
  shasum -a 256 -c checksums.sha256
)

RESTORE_DB="six_restore_check_$(date +%Y%m%d_%H%M%S)"
docker exec six-postgres createdb -U postgres "$RESTORE_DB"
docker exec -i six-postgres pg_restore -U postgres -d "$RESTORE_DB" \
  --no-owner --no-privileges --exit-on-error --single-transaction \
  < "$BACKUP_DIR/database.dump"

docker exec six-postgres psql -X -U postgres -d "$RESTORE_DB" \
  -v ON_ERROR_STOP=1 --csv -c "SELECT 'reports' AS table_name, count(*) AS rows FROM reports UNION ALL SELECT 'content_entries', count(*) FROM content_entries UNION ALL SELECT 'app_settings', count(*) FROM app_settings UNION ALL SELECT 'anonymous_devices', count(*) FROM anonymous_devices UNION ALL SELECT 'usage_events', count(*) FROM usage_events UNION ALL SELECT '_prisma_migrations', count(*) FROM _prisma_migrations ORDER BY table_name" \
  > "$BACKUP_DIR/restored-table-counts.csv"
diff -u "$BACKUP_DIR/table-counts.csv" "$BACKUP_DIR/restored-table-counts.csv"
printf 'Restore test database: %s\n' "$RESTORE_DB"
```

`createdb` 若提示已存在，应停止核对，不能继续恢复到那个库。任何恢复失败也停止检查，不在非空演练库上反复追加恢复。演练库可能含真实问题，验证后由操作者确认准确库名再单独清理；本文不提供自动删库步骤。

## 6. 迁移到新机器

1. 完成最终停写备份、文件校验和异地复制；旧环境保留，先不要删卷。
2. 新机器安装对应 Node.js / pnpm，准备 PostgreSQL 16 和独立 Redis，核对容器名、端口、数据库和存储权限。当前 Compose 密码和开放监听适用于本机开发，不能原样暴露到公网。
3. 将 `source.bundle` 克隆到新目录，按 `git-commit.txt` 检出备份提交，再将 `project.tar.gz` 解压到该目录，恢复备份时的文件状态。先审查 `git-status.txt`，显式核对其中的删除项；归档会补回修改和新增文件，但不会自动删除 Git 检出后存在的文件，也不保存原来的暂存区划分。不要解压覆盖另一个正在工作的仓库。
4. 恢复加密保管的环境配置；更新 `SIX_ROOT`（若配置）、数据库地址、Redis 地址、API/Web 地址、域名和 AI 密钥。不要把旧机器路径或本机端口照搬到容器网络。
5. 在目标实例创建空数据库，用第 5 节的 `pg_restore` 方式恢复，将容器及库名替换为目标专属资源。不使用 `--clean` 覆盖已有业务库，不通过 `db:seed` 替代恢复。
6. 安装锁定依赖并生成 Prisma Client。先以备份对应版本验证，再对新版本应用经过测试的新增迁移。
7. API/Web 先以受限访问方式启动，完成下述验收，最后启用 Worker 和新的用户流量。生产需另行配置 HTTPS、访问控制及可观测性，本指南不等于已经完成生产发布。

在目标项目根目录、且目标 `DATABASE_URL` 已通过安全方式注入当前命令环境后执行：

```bash
pnpm install --frozen-lockfile
pnpm run db:generate
pnpm --filter @six/database exec prisma migrate status --schema prisma/schema.prisma
pnpm --filter @six/database exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @six/database exec prisma migrate status --schema prisma/schema.prisma
pnpm run build
```

目标恢复的是完整 schema 和迁移历史，因此应先恢复，再检查/部署尚未执行的迁移。`migrate status` 若只报告预期的待执行迁移，审核后再执行 `deploy`；若报告迁移失败、分叉或未知差异，则停止处理。不要为了继续运行而使用 `migrate reset`、`db push --force-reset` 或随意修改迁移历史。

根目录 `pnpm db:migrate` 实际执行 `prisma migrate dev`，只用于开发创建/调试迁移，不是生产或已恢复数据库的迁移命令。`pnpm db:seed` 会更新同名内容的正文、摘要、发布状态及 payload，只用于空环境首次初始化或明确批准的内容刷新。

## 7. 验收与回滚

验收项：

- 校验和通过、恢复命令成功、所有表及迁移状态符合预期；最终停写快照的逐表数量一致。
- 603 是本次历史快照，之后以当次备份清单为准；同时核对内容分类、发布状态及生产可见性，不能只比较总数。
- 知识中心、专题、教程、FAQ 和知识卡能打开；图片/SVG 没有缺失，关联链接正常。
- 如果备份已有报告，抽查原报告 ID、问题、排盘、保存的 AI 内容及下载功能，不重新起卦或强制重新调用 AI 来替代历史数据。此次 0 报告快照不能完成旧报告迁移验收。
- 设置能保存，生成的新报告确实落库，API 重启后仍可读取；真实 AI 调用及结果持久化通过。
- `/health`、`/ready`、实际 SQL 读写均核查；旧新 Worker 不重复消费；前端请求的是新 API。
- `APP_ENV` 从 development 改为 beta/production 时，只展示 `PUBLICATION_READY` 内容是既有行为，不应误判为迁移丢失。

回滚方式：

1. 新环境尚未接收写入：停止新 API / Worker，恢复旧环境流量和对应版本，保留新环境用于排查。
2. 新环境已产生报告或修改：先冻结写入并备份新库及资产，再制定增量合并或兼容恢复方案。不能直接切回旧快照丢弃新数据。
3. 数据库升级涉及不兼容变更时，必须恢复到独立空库并配套旧版本代码；不要只回退应用代码或反向执行未经验证的 DDL。

## 8. 日常策略与边界

- 建议每日一次整库备份；升级、批量内容导入或迁移前额外备份。代码/规则/资产改变时同步归档。
- 初始保留策略可用最近 7 个日备份、4 个周备份，至少一份在另一台设备或加密远端。该策略只是建议，目前没有自动任务。
- 每月至少一次恢复演练，记录备份时间、代码版本、校验和、数据量、恢复结果和耗时。只收到“备份成功”日志不足以证明能恢复。
- 一天一次备份最多可能丢失约一天新增数据；需要更低数据丢失窗口时，另行部署 WAL 归档/PITR，当前未配置。
- 只清理 Docker 构建缓存不需要删除 SIX 数据库。禁止把 `docker compose -p six down -v`、`docker volume prune` 或直接删除 `Docker.raw` 当作日常清理。
- 本文示例没有自动处理密钥、在途队列或旧内存报告；这些未完成时不能声称完整迁移已通过。

## 9. 本次文档验证记录

2026-09-02 已在源卷只读挂载的临时内存副本中验证 PostgreSQL 16 的 custom-format `pg_dump`、归档目录读取、空库 `pg_restore --single-transaction` 和逐表计数比较。恢复后的 6 张表计数与源副本完全一致，包括内容 603 条、设置 1 条、报告 0 条。

此测试不开放端口、不调用 AI、不启动原数据库；测试库和导出文件随临时容器销毁。Markdown 中的 Bash 代码块及本地链接也已检查。尚未执行永久备份、异地复制、项目文件恢复、密钥/队列迁移或生产切换，不能将此记录当作完整迁移验收。
