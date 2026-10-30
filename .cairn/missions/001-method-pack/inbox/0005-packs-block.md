# Decision 0005 — the packs block in the packet and the review report

Status: waiting for human approval. `docs/protocol.md` is unchanged.
Date: 2026-10-31
Current protocol hash: `sha256:35115bd851eb2435778380d84bb2a6a46b57915c802add1b5ef656b551a0bcba`.
Serves: B7; the plan amendment that declares these T7 files was approved by Cairn under
`approved_by: cairn`.

## Why this is a human decision

B7 requires `cairn next` to inject the relevant capability and task evidence to record `use`,
`not-applicable`, or `absent` with the floor. That changes the dispatch packet and the
`review_result` report shape. The mission contract says a packet or report schema change is a
protocol amendment with `approved_by: human`. The detector, the `cairn review` writer, the
`task_started` writer, and the audit repair are already implemented and tested; this file asks
only for the schema and the invariant 3 wording.

## Proposed contract

### 1. One vocabulary

`mode` is one of `use`, `human-in-loop`, `not-applicable`, `absent` in both the packet and the
report. The playbook already uses `use` and `human-in-loop`; the worked example's `used` was
changed to `use` so there is one spelling.

- `use`: the pack is present and the capability applies.
- `human-in-loop`: the pack is present but the capability asks the human.
- `not-applicable`: the pack is present but the task has no surface for it; `reason` required.
- `absent`: the pack is not present, or is a version mismatch / not invocable; the floor is
  used. The report must name the floor in `evidence`.

### 2. Dispatch packet `packs`

`cairn next` adds a `packs` array to the existing packet. Every packet carries exactly two
entries, so the adapter never has to guess whether a pack was considered.

```json
"packs": [
  {
    "capability": "test-first",
    "pack": "superpowers",
    "version": "7.0.1",
    "mode": "use",
    "instruction": "superpowers:test-driven-development",
    "fallback": {
      "text": "write the test first, then the implementation, then run the gate",
      "product": { "kind": "gate", "ref": "test" }
    }
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "task files contain no markup or URL target",
    "instruction": "criteria-based review against method/standards/docs.md",
    "fallback": {
      "text": "use the in-repo review checklist",
      "product": { "kind": "path", "ref": "method/README.md" }
    }
  }
]
```

Selection is deterministic from the task's declared files:

- **superpowers**: `test-first` when any file ends in `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`,
  `.jsx`, `.py`, `.rs`, `.go`, `.java`, `.rb`, or `.sh`; otherwise `verify-before-close`
  (`superpowers:verification-before-completion`).
- **Impeccable**: `design-check` when any file ends in `.html`, `.htm`, `.css`, `.scss`,
  `.sass`, `.less`, `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, or `.svg`; otherwise
  `design-review` with `not-applicable` and the reason above.
- `version` is the detected version when present, otherwise the pin.
- `mode` is `absent` when detection returns `absent`, `mismatch`, or `not-invocable`; the
  `fallback` is then the instruction.
- `reason` is optional except when `mode` is `not-applicable`.
- The packet is read-only context. A pack never marks a task done.

### 3. Report `packs`

The adapter report and `cairn review` use the same entry shape, with `evidence` replacing
`instruction` and `fallback`:

```json
"packs": [
  {
    "capability": "test-first",
    "pack": "superpowers",
    "version": "7.0.1",
    "mode": "use",
    "evidence": "test/method.test.mjs, RED then GREEN"
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "no markup or URL; detect on markdown returns []",
    "evidence": "README.md criteria-based review"
  }
]
```

Rules:

- `packs` is a non-empty list on every `review_result`.
- `capability`, `pack`, `version`, `mode`, and `evidence` are non-empty strings.
- `pack` is `superpowers` or `impeccable`.
- `not-applicable` requires a non-empty `reason`.
- `absent` requires `evidence` naming the floor that ran (a gate id, command, or path).
- A pack report is input; the gate evidence is proof. A review never turns a red gate green.

### 4. CLI

Add two commands to the v0.1 table:

| Command | Exit | Behavior |
|---|---|---|
| `cairn start <task>` | 0 / 2 refused | Append `task_started` with the current HEAD as `base`; refuse a task that is done, parked, or already started. |
| `cairn review --file <json>` | 0 / 2 refused | Validate `reviewer`, `verdict`, `findings`, and `packs`, then append `review_result`. |

`cairn start` does not print the packet; `cairn next` remains the only packet command.

### 5. Invariant 3

Replace:

> **The ledger and the code land in the same commit.** A commit without its ledger event is
> not progress; a ledger event without its commit is not progress.

With:

> **A task is one commit transaction.** The work commit carries the code, evidence, and
> `gate_result`; `task_done` lands in the immediately following ledger commit. A work commit
> without `task_done` is not progress; a `task_done` without its work commit is not progress.

This matches the pattern already recorded by T1–T6: `T6: record the worked example tick` then
`T6: record task_done`.

## Exact protocol edits after approval

- `docs/protocol.md`: invariant 3, the `review_result` row, the CLI table, the dispatch packet
  JSON, the report JSON, and one short “Pack record” section stating the five rules above.
- `docs/protocol.zh.md`: the same sections in Chinese, with a translation header naming this
  commit.
- `templates/dispatch.md` and `.zh.md`: a `packs` section and the report placeholder.
- `docs/adapter.md` and `.zh.md`: the report example and the `renderDispatch` input now include
  `packs`.
- `method/playbook.md`: flip the `review` row from `planned:T7` to `exists`.
- `docs/i18n.md`: record the protocol/protocol.zh status.

## What does not change

- No new event name; `task_started` and `review_result` already exist.
- No change to gate semantics, the three-part completion rule, or the ledger format.
- No vendoring of either pack; the packet cites version and instruction only.
- No network or launcher call when a pack is absent.
- Mission #0 is untouched.

## If rejected

The packet and report keep their current shape; B7 stays unproven and Mission #1 cannot close.
The detector and the review/start writers remain useful, but the review cannot require pack
records and `cairn next` cannot claim injection.

## Approval

Reply with one of:

- `approve 0005` — implement the protocol edits with `approved_by: human`, finish T7, then T8.
- `change 0005: <what>` — revise this file first; nothing lands in the protocol.
- `reject 0005` — record the rejection and park B7.
