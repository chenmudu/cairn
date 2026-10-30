<!-- translation of method/templates/task.md at the T4 commit; the English file is authoritative -->

# <task-id> — <标题>

- **服务**：[<验收 id>]
- **依赖**：<任务 id 或无>
- **文件**：<声明的路径>
- **Base**：<提交>

## 上下文

<这个任务为什么存在，动手前读者需要知道什么。>

## 步骤

1. <最小的第一步。>
2. <下一步。>

## 闸门

| 闸门 | 命令 | 严重度 |
|---|---|---|
| <id> | `<command>` | block |

## 证据

- `<evidence/<task>/<gate>.json>`

## 包记录

- 使用：`<pack>:<skill>@<pin>`，证据 `<evidence>`
- 或：`not-applicable: <原因>`
- 或：`absent, floor used`

## 范围之外

- <这个任务不做的最近一件事。>
