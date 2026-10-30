<!-- translation of templates/dispatch.md at the T2 commit; the English file is authoritative -->

# Dispatch — {{task_id}}：{{task_title}}

你是一个适配器。精确执行一个任务，然后返回报告。你不写台账，也不把任务标成完成；控制器运行
闸门并记录完成。

## Mission

{{mission_id}} — {{mission_title}}

本任务服务：{{serves}}

Base 提交：`{{base}}`。从那里开始，不要重写历史。

## 任务

**{{task_id}} — {{task_title}}**

你可以修改的文件：

{{files}}

接口：

{{interfaces}}

## 约束

{{constraints}}

## Policy

- 允许的命令：{{allowed_commands}}
- 禁止的命令：{{forbidden_commands}}
- 预算：{{budgets}}
- 停止条件：{{stop_conditions}}

## 闸门

你返回后，控制器用 `cairn verify` 运行这些闸门。你也可以提前运行以获取反馈；没有记录证据的
闸门不算数。

{{gates}}

## 包

packet 根据声明的文件选择了这些能力。包是上下文，不是完成；记录用了什么、什么不适用，或什么
缺失及所用的地板。

{{packs}}

## 最近的台账

{{ledger_tail}}

## 报告

返回一个 JSON 对象：

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["<sha>"],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": {
    "verdict": "pass | fail",
    "findings": [],
    "packs": [
      { "capability": "...", "pack": "superpowers", "version": "...", "mode": "use | human-in-loop | not-applicable | absent", "reason": "...", "evidence": "..." }
    ]
  },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

规则：

- 一个活动任务。不要修改上面清单之外的文件。
- 永不追加 `ledger.jsonl`；永不写 `task_done`。
- 如果任务无法表达这项工作，返回 `NEEDS_CONTEXT`；不要自己修订计划。
- 如果触发停止条件，返回 `BLOCKED` 并指名它。
