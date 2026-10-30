<!-- translation of docs/adapter.md at the T-004 commit; the English file is authoritative -->

# 适配器契约——把 packet 变成工作

适配器执行一个任务。任务是否完成由 Cairn 判定。这个分工决定了 ledger 为什么可信：适配器可以是
模型、子代理或 shell 脚本，它们都无法把自己的工作标记为完成。

## 输入

`cairn next` 只在 stdout 打印 dispatch packet：

```json
{
  "mission": { "id": "000-bootstrap", "title": "Build Cairn with Cairn" },
  "task": { "id": "T-001", "title": "...", "files": [], "interfaces": {}, "serves": ["A1"] },
  "policy": {
    "budgets": {},
    "allowed_commands": [],
    "forbidden_commands": [],
    "stop_conditions": []
  },
  "constraints": ["..."],
  "gates": [{ "id": "typecheck", "command": "pnpm", "args": ["typecheck"] }],
  "ledger_tail": ["...最近 5 个事件..."],
  "base": "abc1234"
}
```

`src/packet.ts` 的 `renderDispatch(packet)` 用 `templates/dispatch.md` 把同一个 packet 渲染成
markdown 简报。packet 是契约；简报只是给模型看的便利形式。模板拥有说明文字和报告结构，packet
拥有事实。渲染器不认识的占位符会直接报错，而不是输出一份半成品简报。

## 流程

1. 控制器运行 `cairn next`，保存 packet 的 `base`。
2. 适配器从 `base` 开始，只碰声明的文件，可以提前跑 gate 获取反馈。
3. 适配器返回报告。它不写 `ledger.jsonl`，也不写 `task_done`。
4. 控制器运行 `cairn verify <task>`：执行每个声明的 gate，写证据，追加 `gate_result` 事件。
5. 控制器运行 `cairn record <task> --status done`：检查提交、每个 blocking gate 和证据文件，
   然后追加 `task_done`。

`verify` 失败，任务就没有完成。适配器可以修复后再次返回报告；policy 里的尝试预算限制循环次数。

## 报告

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["<sha>"],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": { "verdict": "pass | fail", "findings": [] },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

- `status`：`DONE` 表示可以交给 verify；`DONE_WITH_CONCERNS` 表示 gate 通过但记录了审查顾虑；
  `NEEDS_CONTEXT` 表示 packet 缺少信息；`BLOCKED` 表示 stop condition 或外部依赖阻断了分支。
- `commits`：适配器创建的提交 SHA；没有提交就为空。
- `gates`：可选的本地运行结果。权威结果来自控制器的 `cairn verify`。
- `review`：harness 能跑独立审查时的结论。
- `rulings`：没有人类参与时做出的决定，每个都要有 why 和 `cost_if_wrong`。
- `escalations`：给人类的问题，带选项和默认值。只有提问的那个分支等待。

## 规则

- 一个活跃任务。并行只发生跨 worktree，永远不在单个任务内部。
- 只改声明的文件。列表之外的文件属于范围蔓延；先修改 plan。
- 不改 plan、不改 ledger、不重写历史、不 push。
- stop condition 优先于完成：不可逆或破坏性操作、安全敏感操作、写仓库之外、plan 无法恢复、
  预算耗尽、怀疑目标漂移、验收不可达、或削弱 gate。
- gate 是固定 argv，不做 shell 插值；参数放在 `args`。退出码就是判决。
- 适配器可以使用任何流程包（例如 superpowers）或质量标准（例如 Impeccable）。Cairn 不导入
  它们，只记录它们产出的结果。

## Harness

ZCode 是第一个 harness：用渲染后的简报派发子代理，然后由控制器运行 `cairn verify` 和
`cairn record`。`.zcode` hook 只在会话开始时注入目标锚点，它是胶水，不是契约的一部分。
任何能执行命令并返回 JSON 的 harness 都可以。

## 失败模式

- 适配器说完成但 `verify` 失败：以退出码为准；修复后重新 verify。
- 适配器写了 ledger：这是契约违规。拒绝报告并 reconcile。
- `verify` 和 `record` 之间崩溃：`gate_result` 事件和证据还在，`task_done` 不在。
  `cairn status` 仍显示任务未完成；重新运行 `record` 是安全的，因为它拒绝重复记录。
