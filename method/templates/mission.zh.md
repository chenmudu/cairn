<!-- translation of method/templates/mission.md at the T4 commit; the English file is authoritative -->

---
schema: cairn/mission@0.1
id: <mission-id>
title: <标题>
status: active
created: <YYYY-MM-DD>
owner: <owner>
acceptance:
  - id: A1
    check: <命令或审查者能验证的条件>
---

# <标题>

## 意图

<这个 mission 交付什么，为什么仓库现在做不到。>

## 非目标

- <这个 mission 明确不做的事。>

## 约束

- <每个任务都要遵守的规则。>

## 验收

- A1: <结果，不是活动。>

## 当前动作

台账是事实源。开始前运行 `node scripts/goal-check.mjs`；下一个任务来自台账和计划，永远不来自
本节。
