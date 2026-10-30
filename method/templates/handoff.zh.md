<!-- translation of method/templates/handoff.md at the T4 commit; the English file is authoritative -->

# Dispatch packet — <task-id>

- **任务**：<标题>
- **服务**：[<验收 id>]
- **Base**：<提交>
- **文件**：<声明的路径>
- **闸门**：<闸门 id 和命令>

## 包

对任务用到的每个能力：

- **能力**：<名称>
- **包**：<superpowers 或 Impeccable，带 pin>
- **模式**：<use、human-in-loop 或 not-applicable>
- **指令**：<确切的 skill 或命令>
- **回退**：<可执行的地板>

包缺失时，指令是 `absent, floor used`。

## 约束

- 一个 tick 推进一个任务。
- 适配器报告永不写 `ledger.jsonl`。
- 包报告是输入；闸门和台账是证明。
- 不 push、不发布、不改写历史、不跑破坏性命令。

## 回报

- 提交和改动的文件。
- 闸门结果，带退出码和证据路径。
- 使用的包和 pin，`not-applicable` 加原因，或 `absent, floor used`。
- 任何偏离、ruling 或 escalation。
