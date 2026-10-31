<!-- translation of .cairn/missions/002-completion-integrity/inbox/0009-p0-fixture-update.md; the English file is authoritative -->

# 决策 0009 — T3 声明清单外的授权修改

- Status: 2026-10-31 经人类批准（T3 指令）
- Date: 2026-10-31
- Serves: A2
- Scope: task-scoped（Mission #2 的 T3）

## 背景

T3 声明的文件是 `src/review.ts`、`src/complete.ts`、`src/cli.ts`、`test/review.test.ts`、
`test/complete.test.ts`、`test/cli.test.mjs`、`docs/workflow.md`、`docs/workflow.zh.md`、
`docs/i18n.md` 和本 mission 目录。`test/p0.test.mjs` 不在其中。

T3 把 review 契约从 `{reviewer, verdict, findings, packs}` 扩成 D2 形状，并要求最后一条 review
之后有一条人类 `authorization`。`test/p0.test.mjs` 会真的关闭一个夹具 mission，所以它的
`REVIEW` 常量不再满足契约，台账里也没有 authorization 事件。旧测试失败是夹具原因，不是它守护的
D1 规则（先提交台账再关闭）有问题。

## 决定

只把 `test/p0.test.mjs` 的夹具更新到契约：补齐 review 字段，在夹具 mission 里写出
`evidence/review.json` 和 `evidence/T1/code.json`，并在 review 之后追加一条决策 0007 形状的
`authorization` 事件。

该文件里的断言一条不改：未提交时拒绝、提交后台账可关闭、关闭后 reconcile 干净，全部保留。
不为让夹具通过而放宽 `src/review.ts`、`src/complete.ts`、`src/cli.ts` 的规则。

## 后果

全量测试回到绿色，且没有放松门禁。T3 声明清单外的唯一写入是这个测试夹具，记录在此；
`audit-session` 可能把它报成计划外写入，本决策即其授权。