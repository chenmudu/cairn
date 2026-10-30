<!-- translation of docs/decisions/0001-name-cairn.md at the T2 commit; the English file is authoritative -->

# 0001 — 名字是 Cairn

- 状态：已接受
- 日期：2026-10-31

## 背景

项目需要一个能编码核心论点的名字：进展存在于仓库，而不是对话；后来的 agent 能顺着痕迹接手，
不需要前一个 agent 的上下文。

## 决定

项目名为 **Cairn**。CLI 是 `cairn`。完成的任务留下一个提交、一份证据和一个台账事件——
路上多一块石头。

标语：**Leave a trail, not a transcript.**

## 考虑过的替代方案

| 名字 | 为什么不用 |
|---|---|
| Baton | 暗示交接，而不是持久证据。 |
| Capstan | 暗示缓慢的重物拖拽，而不是可读的痕迹。 |
| Keel | 暗示稳定，而不是进展。 |
| Mission | 太泛；与领域术语冲突。 |

## 后果

- `cairn` 是命令名、包名和仓库名。
- 领域词汇保持独立：Mission、Task、Tick、Gate、Evidence、Ledger。
- 公开发布前检查包名和商标可用性；如果 `cairn` 已被占用，先在这里改工作名，而不是在代码里。
