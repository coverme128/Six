# 64｜规则生命周期与 Feature Flags

## 生命周期
DRAFT → REVIEW_REQUIRED → ADVANCED_BETA → CORE_V1/PRODUCTION_ENABLED。

## 首版 Flags
- `liuyao.core_v1=true`
- `liuyao.advanced_beta=false`
- `liuyao.review_required=false`
- `liuyao.precise_timing=false`
- `liuyao.rule_debug_panel=false`（仅开发/预发布可开）

## 回滚
规则配置必须按 profile 与版本发布。出现异常时可以整体回退到上一 profile，不允许在线手工修改单条规则后不留审计记录。

## Shadow Mode
未来高级规则先在影子模式记录命中，不进入用户报告；经过抽检和 Beta 后再考虑升级。
