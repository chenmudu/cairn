<!-- translation of .cairn/missions/002-completion-integrity/inbox/0008-check-targets-active-mission.md; the English file is authoritative -->

# 决策 0008 — check-targets 按活动 mission 收口

- Status: 2026-10-31 经人类批准（T3 指令）
- Date: 2026-10-31
- Serves: A5
- Scope: mission-scoped（Mission #2）

## 背景

- `docs/protocol.md` 当前哈希是 `sha256:f9498f31...`，即 Mission #1 在其台账里冻结的哈希
  （`.cairn/missions/001-method-pack/ledger.jsonl:44`）。
- CI 执行 `node scripts/check-targets.mjs .cairn/missions/001-method-pack`
  （`.github/workflows/gates.yml:35`）。
- `scripts/check-targets.mjs` 没有 active-mission 逻辑；给它哪个 mission，它就给哪个 mission 重建哈希链。
- T7 会在 Mission #2 的 `mission_amended` 事件下修改 `docs/protocol.md`。文件一变，Mission #1 的链就
  与工作区不匹配；即使 Mission #1 的台账和它自己的产物都没动，现有 CI 步骤也会失败。

## 决定

T5 必须让 `check-targets` 跳过“已关闭且不是活动 mission”的 mission（读 `.cairn/config.json`），或者
从 CI 移除 Mission #1 那一步。T5 在任务报告或决策里记录理由。不得修改 Mission #1 的台账。T3 只记录
这条义务，不改 `scripts/check-targets.mjs`。

## 后果

T7 可以改 `docs/protocol.md` 而不弄断历史 mission 的 CI 步骤。活动 mission 的 target 链仍然被检查。
对非活动的已关闭 mission 运行 `check-targets` 会报告跳过，而不是假违规。
