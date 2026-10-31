# Decision 0007 — Authorization event shape

- Status: approved by the human on 2026-10-31 (T3 instruction)
- Date: 2026-10-31
- Serves: A2
- Scope: mission-scoped (Mission #2)

## Context

D2 requires a human authorization event with `scope: mission_done`, `approved_by: human`, and a
reason, recorded after the last review. D8 requires
`cairn record --authorized --paths <a,b> --why <text> --approved-by human` and an event with
`paths`, `approved_by`, `why`, and `date`. The two decisions name the reason differently
(`reason` versus `why`), and only D8 carries `paths`. Implementing both literally would require
two incompatible event shapes.

## Decision

The authorization event shape is the union:

```json
{
  "scope": "mission_done",
  "paths": ["optional", "path-scoped authorization"],
  "approved_by": "human",
  "why": "why the human authorized this",
  "date": "2026-10-31"
}
```

- `scope` is optional; a mission close requires `scope: mission_done`.
- `paths` is optional; T6's path-scoped authorization uses it.
- `approved_by` must be `human`.
- `why` is the only reason field. D2's "reason" is `why`; no second `reason` field is added.
- `date` is required and non-empty.

T3 enforces at `mission_done`: an `authorization` event exists with `scope: mission_done`,
`approved_by: human`, non-empty `why` and `date`, and `ts` later than the last `review_result`.
T6's writer must emit this shape. `authorization` is added to the validator's event names so the
mission gate accepts it.

## Consequences

T3 can validate the event before T6 writes it; tests use fixture ledger lines. T6 implements the
writer against the same shape, so the close path has one event definition. A review with only a
`reason` field is not accepted.
