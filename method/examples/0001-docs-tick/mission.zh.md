<!-- translation of method/examples/0001-docs-tick/mission.md at the T6 commit; the English file is authoritative -->

---
schema: cairn/mission@0.1
id: 0001-docs-tick
title: 一个 tick，一条轨迹
status: closed
created: 2026-10-31
owner: cairn
acceptance:
  - id: A1
    check: node scripts/check-example.mjs --example method/examples/0001-docs-tick 退出 0
  - id: A2
    check: 台账记录一个通过的闸门、task_done，以及带包记录的审查
---

# 一个 tick，一条轨迹

## 意图

新操作者读完协议，仍可能看不到一个完成的 tick 留下什么。这个样例是一个真实的小 tick：一个
任务、一个产物、一个闸门、一个证据文件、一个 `task_done` 和一次审查。它是展品，不是活动
mission。

## 非目标

- 不做 UI、数据库、托管服务。
- 不做调度器或多 tick 循环。
- 不设第二套台账。

## 约束

- 样例自包含在这个目录里。
- 闸门能从仓库根目录运行。
- 包记录写明用了什么，或者 `not-applicable` 加原因。

## 验收

- A1：`node scripts/check-example.mjs --example method/examples/0001-docs-tick` 退出 0。
- A2：台账里有退出 0 且带证据的 `gate_result`、`task_done`，以及带包记录的
  `review_result`。

## 当前动作

这个 mission 已关闭。台账是记录；产物是 `product.md`。
