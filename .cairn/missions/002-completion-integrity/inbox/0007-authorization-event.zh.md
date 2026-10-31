<!-- translation of .cairn/missions/002-completion-integrity/inbox/0007-authorization-event.md; the English file is authoritative -->

# 决策 0007 — authorization 事件形状

- Status: 2026-10-31 经人类批准（T3 指令）
- Date: 2026-10-31
- Serves: A2
- Scope: mission-scoped（Mission #2）

## 背景

D2 要求一条带 `scope: mission_done`、`approved_by: human` 和理由的人类授权事件，且时间晚于最后一条
评审。D8 要求 `cairn record --authorized --paths <a,b> --why <text> --approved-by human`，事件带
`paths`、`approved_by`、`why` 和 `date`。两份决定对理由字段的命名不同（`reason` 对 `why`），且只有
D8 带 `paths`。按字面同时实现会得到两套互不兼容的事件形状。

## 决定

authorization 事件取并集：

```json
{
  "scope": "mission_done",
  "paths": ["可选的路径范围授权"],
  "approved_by": "human",
  "why": "人类批准这次关闭的理由",
  "date": "2026-10-31"
}
```

- `scope` 可选；关闭 mission 时要求 `scope: mission_done`。
- `paths` 可选；T6 的路径范围授权使用它。
- `approved_by` 必须是 `human`。
- `why` 是唯一的理由字段。D2 的 “reason” 就是 `why`，不再新增第二个 `reason` 字段。
- `date` 必填且非空。

T3 在 `mission_done` 时校验：存在 `authorization` 事件，`scope: mission_done`、
`approved_by: human`、`why` 和 `date` 非空，且 `ts` 晚于最后一条 `review_result`。T6 的写入器按
这个形状实现。把 `authorization` 加进校验器的事件名集合，mission 门禁才不会把它判成未知事件。

## 后果

T3 可以在 T6 的写入器之前先做校验；测试用夹具台账行。T6 按同一形状实现写入器，关闭路径只有一套事件
定义。只带 `reason` 字段的评审不会被接受。
