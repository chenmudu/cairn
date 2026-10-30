<!-- translation of .zcode/skills/cairn-guard/SKILL.md at the decision-routing commit; the English file is authoritative -->

---
name: cairn-guard
description: 在 Cairn 仓库的每个任务开始和结束时使用。运行目标检查和会话漂移审计，并拒绝没有闸门证据的完成声明。
---

# Cairn guard

这个仓库让完成成为仓库的属性，而不是对话的属性。guard 存在的目的，是让 agent 不需要人类重复
目标。

## 任何实现之前

1. 运行 `node scripts/goal-check.mjs`。
2. 用一句话说出：当前任务、它的 `serves` 链接、验收检查。
3. 如果任务不在 `plan.md`、没有 `serves`，或检查失败，停下先修订计划。不要开始计划表达不了的
   工作。

## 写决策之前

1. 运行 `node scripts/check-decisions.mjs`。
2. 说出 scope 和路径：项目级 ADR 放 `docs/decisions/`；mission escalation 放
   `.cairn/missions/<id>/inbox/`。
3. 写完后再次运行检查。路径错、字段缺失或缺少中文 companion 都是失败。

## 声明完成之前

1. 运行任务里每个 `severity: block` 闸门。贴出命令和退出码。
2. 运行 `node scripts/audit-session.mjs`。报告漂移信号：目标纠正、没有闸门的完成声明、计划
   之外的写入、把决定推回人类的确认请求。
3. 完成需要三样同时成立：提交、阻塞闸门退出 0、`task_done` 事件。绿色闸门证明这一步，不是
   mission。

## 规则

- 永不要求人类重新确认目标或定位。读 `README.md`、活动的 `.cairn/missions/<id>/mission.md`
  和台账。
- 人类决定是 escalation；没有人类的决定是 ruling。记录下来。
- 如果写入落在任务声明的文件之外，记录 ruling 或修订计划。
- 声明包缺失、存在或可用之前，检查真实路径并跑版本命令。记录路径、版本和命令结果。技能列表
  和记忆不是证据。
- 空结果或 `not-applicable` 不是通过。记录原因和回退。
- 必需检查跑不了时，记录失败和替代证据。永不把没跑的检查报告为通过；guard 本身错了就修
  guard。
- 会话启动 hook 会从仓库打印同样的锚点。把它当作提醒，而不是运行检查的替代品。
