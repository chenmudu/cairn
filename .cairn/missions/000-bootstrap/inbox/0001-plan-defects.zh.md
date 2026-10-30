<!-- translation of .cairn/missions/000-bootstrap/inbox/0001-plan-defects.md at the T3 amendment; the English file is authoritative -->

# 0001 — T-001 之后的未决缺陷与风险

- 状态：未决（第 3 项），已解决（第 1、2、4 项）
- 更新：2026-10-31
- Legacy: true

## 1. T-003 的 fixture 闸门极性 — 已解决

计划已修订：闸门现在是
`node scripts/validate-mission.mjs --expect-invalid test/fixtures/missing-gate`，`T-003`
给校验器加了这个标志。

## 2. T-002 的完成条件在 T-001 之后过期 — 已解决

计划已修订：拒绝目标改为 `T-002` 自己，它当时还没有证据。

## 3. 不变量 3 对自引用的 head 无法成立 — 未决

`task_done.head` 指向工作提交。包含它的事件只能在那个提交存在之后写入，所以台账和代码无法
落在同一个提交里。

选项：

- 定义约定：台账事件落在 `head` 之后的那个提交里，`reconcile` 接受它。
- 把 `head` 重新定义为 tree 对象，或让 `cairn record` amend 提交。
- 为 Mission #0 记录一个只限自举期的例外。

未决时的默认：第一个选项，在 `T-005` 前接受。`T-002` 遵循了它：它的 `task_done` head 指向
工作提交，事件落在其后的台账提交里。

## 4. T-002 需要 TypeScript 工具链 — 已解决

计划期望 `pnpm typecheck`，但 `typescript` 没有安装。

解决：`typescript@7.0.2` 和 `@types/node@26.6.6` 是 devDependencies；`pnpm-lock.yaml` 已
提交；`pnpm typecheck` 退出 0。Node 24 在运行时剥离类型，所以 CLI 和测试不需要构建步骤。
没有增加运行时依赖。
