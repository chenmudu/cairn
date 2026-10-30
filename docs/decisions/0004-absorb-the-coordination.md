# 0004 — Absorb the coordination, not the pack

- Status: accepted
- Date: 2026-10-31

## Context

Decision 0002 settled ownership: superpowers and Impeccable stay external, consumed by
reference, and Cairn keeps the only ledger. It did not settle what happens to a capability
that only a pack provides — the superpowers progress ledger, subagent orchestration,
Impeccable's detector, browser critique, or live mode.

The first answer was "skip it when the pack is absent". That is wrong. It makes the method
hostage to an install and leaves pack state unowned when the pack is present. The correct
model is three layers:

1. **Floor** — a simple, in-repo version that always runs and keeps the method moving.
2. **Pack** — the better implementation, pinned and optional.
3. **Seam** — the coordination layer that maps pack state into Cairn state and decides what
   wins. Cairn owns the seam.

The human made this call on 2026-10-31: the floor is ours, the packs are better when present,
and someone must coordinate the second ledger. That someone is Cairn.

## Source facts (verified 2026-10-31)

These are read from the pinned source, not inferred:

- **superpowers 7.0.1** `skills/executing-plans/scripts/task-start` prints `brief` and `base`;
  it does not write the progress ledger. `scripts/task-done` appends
  `Task N: complete (commits <base>..<head>, tests: <cmd> → <last line>)` only after the test
  command exits 0. The workspace is `<repo-root>/.superpowers/sdd/<plan-basename>/`, which is
  git-ignored scratch (`subagent-driven-development/SKILL.md`).
- **superpowers 7.0.1** `skills/executing-plans/SKILL.md` runs tasks continuously and says not
  to pause between tasks; only irreversible/destructive work, security, an external side
  effect, or an unrecoverable plan stops it. `requesting-code-review` dispatches a reviewer
  subagent; `using-git-worktrees` asks the human before creating a worktree.
- **Impeccable 4.8.0 (commit df3a4abe7)** `skill/reference/critique.md` requires two isolated
  assessments, browser/detector evidence, and ends by asking the user a question.
  `skill/reference/audit.md` is web-only, scores five dimensions 0–4, and tags findings P0–P3.
  `detect` scans markup and URLs only; exit 0 is clean, 2 is findings, 1 is a scan failure;
  the README declares 62 rules. `node cli/bin/cli.js detect README.md --json` returns `[]`,
  so markdown is `not-applicable`, not clean.
- **Impeccable 4.8.0** `init` and `document` are interview-based and UI-specific: they write
  `PRODUCT.md` and `DESIGN.md`; they must not be used to invent product or visual truth in an
  unattended run.

The registry marks these capabilities `human-in-loop` or `not-applicable` rather than
pretending they ran. A clean-looking empty result is not evidence.

## Decision

Cairn is the coordination layer between the packs and the work.

- **No orphan capabilities.** Every pack capability Cairn uses is registered with: the pack
  and pin, the Cairn owner artifact, the coordination contract, the simple fallback, and
  whether it is required or optional. A capability not in the registry is not used.
- **The pack may keep its own working state.** That state is adapter-local. Cairn reconciles
  it, records divergence, and remains the only source of completion truth.
- **The fallback is executable.** It is a real practice with a command or artifact, not a
  placeholder. It keeps the method running; it does not pretend to be the pack.
- **Presence never bypasses a gate.** A pack report is an input. `cairn verify` is the proof.
- **Absence is recorded, not hidden.** A task names the pack used and its pin, or says
  `absent, floor used`.
- **A required capability is an escalation.** If an acceptance criterion explicitly requires
  a pack capability and the pack is absent or unpinned, park and escalate. Do not substitute
  the fallback and claim the pack's result.
- **Detect, do not remember.** Cairn detects pack availability and injects the result into the
  task. The model is not the authority on what is installed or which process applies.

Decision 0002 still holds: no vendoring, no merge, no second ledger. 0004 adds: no skipped
capability without a fallback and no uncoordinated pack state.

## The registry

The initial registry lives in `method/playbook.md` and is checked by `check-method`. Its rows:

| Capability | Pack and pin | Cairn owner | Coordination contract | Simple fallback |
|---|---|---|---|---|
| Process planning | superpowers `writing-plans`, `executing-plans` @ 7.0.1 | `plan.md`, `cairn next` | Cairn's plan and packet are authoritative; the pack's plan is an optional internal aid and stays adapter-local | Hand-written plan + `goal-check` |
| Test-first | superpowers `test-driven-development` @ 7.0.1 | `test` gate | RED→GREEN evidence lands in `gate_result` | Write the test first, then the gate |
| Verification | superpowers `verification-before-completion` @ 7.0.1 | `cairn verify` | Claims without gate evidence are rejected | Run the gate |
| Review | superpowers `requesting-code-review` @ 7.0.1 | `review_result` | Dispatches a reviewer subagent; findings map to a verdict; without a subagent, a fresh-context reviewer uses the same checklist | In-repo review checklist |
| Subagents | superpowers `dispatching-parallel-agents`, `subagent-driven-development` @ 7.0.1 | Dispatch packet + report | One packet per task; reports aggregate; no ledger writes | Single-agent serial execution |
| Worktrees | superpowers `using-git-worktrees` @ 7.0.1 | `base`/`head`, one active task | The skill asks the human before creating a worktree; unattended runs skip it; `reconcile` checks commits | Serial branch |
| Progress journal | superpowers `.superpowers/sdd/<plan>/progress.md` @ 7.0.1 | `ledger.jsonl` | The journal records completion lines only; `task-start` prints brief/base but writes nothing; the workspace is git-ignored scratch. Cairn records `task_started`, reconciles the completion lines, and the report carries the Cairn↔SP task-number mapping | `cairn next/verify/record` |
| Design context | Impeccable `PRODUCT.md`/`DESIGN.md` @ 4.8.0 | Mission/product context | Referenced once; no duplicate token source | In-repo product/design brief |
| Deterministic design check | Impeccable `detect` (62 rules) @ 4.8.0 | Gate evidence | Scans markup and URLs; exit 0 clean, 2 findings, 1 scan failure. Markdown returns `[]` and is `not-applicable`, not clean | In-repo checklist |
| Design review | Impeccable `critique`/`audit` @ 4.8.0 | `review_result` | Web/native UI only. `critique` asks the user and is human-in-loop; `audit` scores five dimensions 0–4; P0–P3 map to findings | In-repo review checklist |
| Live and hooks | Impeccable `live`, hooks @ 4.8.0 | Not in the protocol | Human-in-loop only; never the completion path | Explicit CLI + evidence |

## Detection and activation

Documentation alone still relies on the model remembering to read it. The seam is
operational:

1. **Detect.** `check-method --packs` (later `cairn packs`) checks configured paths and known
   install locations, reads the version, and reports `present`, `invocable`, and `pinned`.
   Detection is deterministic and advisory; it never blocks a gate.
2. **Inject.** `cairn next` includes a `packs` block in the dispatch packet. For each
   capability the task uses, it names the pack, pin, path, exact skill or command, a `mode`
   (`use`, `human-in-loop`, or `not-applicable`), and the fallback. The adapter receives an
   instruction, not a bibliography.
3. **Record.** The adapter report names the packs it used and any deviation. If a pack was
   absent, it says `absent, floor used`.
4. **Verify.** Pack output becomes evidence; `cairn verify` remains the proof. `cairn
   reconcile` checks pack-side state against the ledger.

This is the difference between "the method mentions superpowers" and "the runtime hands
superpowers to the executor". The model still executes; it is not the authority on what
exists or what counts as done.

Concrete activation:

- **superpowers**: the packet names `superpowers:test-driven-development` at 7.0.1 and its
  skill path. The adapter invokes the skill or reads it; the output is tests and gate evidence.
  The installed root is discovered from `CAIRN_SUPERPOWERS_DIR`, then the harness plugin cache.
- **Impeccable**: the packet names `impeccable detect --json` from the pinned checkout,
  invoked as `node cli/bin/cli.js detect --json`. Never `npx` at runtime: it reaches the
  network and violates policy. The detector JSON becomes evidence.
- **Fallback**: every injected instruction carries the fallback command or checklist, so an
  absent pack produces a planned path instead of improvisation.

Detection paths are configuration, not hardcoded machine paths. A repository with neither
pack must still pass every gate; detection reports absence, and the packet says
`absent, floor used`.

The `packs` block changes the packet and report schema. That is a protocol amendment and
requires `approved_by: human`. Until it lands, the playbook and the dispatch template carry
the block as an extension; the runtime injection is planned, not silently added.

## Worked example: the second ledger

When superpowers executes a task, it may keep `.superpowers/sdd/<plan>/progress.md` and run
its own `task-start`/`task-done` scripts. Cairn does not pretend that file does not exist, and
does not let it become a second truth.

- The coordinator starts the adapter from the Cairn packet.
- The adapter returns its report and may keep its journal.
- The coordinator records `task_started`, `gate_result`, and `task_done` in `ledger.jsonl`.
- `cairn reconcile` compares the adapter's journal with the ledger; a missing or extra entry
  is a finding, not a silent overwrite.
- The Cairn ledger wins. The journal is evidence, or it is discarded after reconciliation.

Without superpowers, the same loop runs with `cairn next`, `cairn verify`, and `cairn record`.
That is the simple version, and it is enough to finish.

## Worked example: design standards

Impeccable's detector and critique are better than a hand-written checklist, when present.

- `PRODUCT.md` and `DESIGN.md` are referenced as context, never duplicated into mission files.
- Detector JSON becomes gate evidence; severity mapping is fixed in policy, not per run.
- `critique`/`audit` findings become a `review_result`; only the severities the policy names
  as blocking can block.
- Without Impeccable, the in-repo standards apply. If a UI acceptance criterion explicitly
  requires the detector, absence is an escalation, not a checklist pass.

## Relationship to 0002

0002 and 0004 agree on ownership: no merge, no vendoring, one ledger, adapter reports never
write the ledger. They differ on one sentence. 0002 said a pack may not bring its own progress
file. 0004 refines that: a pack may keep an adapter-local journal, but the journal is not a
source of truth. Completion comes only from Cairn events; `cairn reconcile` compares the two;
durable state that affects completion is expressed as ledger events. The journal is disposable
working state, not a second bookkeeping system.

The refinement is deliberate. Forbidding the journal does not remove it; it pushes the
coordination problem into the model, which is exactly what this decision rejects. Allowing it
with reconciliation keeps one source of truth and makes divergence visible.

## Consequences

- `method/playbook.md` maps every phase to three columns: Cairn floor, pack enrichment, and
  the seam. `check-method` rejects a row with a missing floor or fallback.
- `method/standards` is the floor for docs, code, and workflows; Impeccable enriches the UI
  part.
- T3 adds `check-method --packs`; T7 adds packet injection and a `cairn review` command. The
  packet/report schema change goes through a human-approved protocol amendment.
- The registry is documentation first, but detection is not: the checker reports availability
  on every run, so a missing pack is visible instead of assumed.
- The method is executable with zero packs. The packs make it better, not possible.
