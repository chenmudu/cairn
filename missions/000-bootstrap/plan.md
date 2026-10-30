---
schema: cairn/plan@0.1
mission: 000-bootstrap
tasks:
  - id: T-001
    title: Protocol schema and validator
    deps: []
    risk: low
    status: done
    serves: [A1]
    files:
      - docs/protocol.md
      - scripts/validate-mission.mjs
      - test/validate-mission.test.mjs
      - test/fixtures/missing-gate/
      - package.json
    interfaces:
      produces:
        - "validateMission(dir): { ok: boolean, errors: string[] }"
    gates:
      - id: validate
        command: node
        args: ["scripts/validate-mission.mjs", "missions/000-bootstrap"]
        severity: block
  - id: T-002
    title: Ledger and CLI skeleton
    deps: [T-001]
    risk: medium
    status: todo
    serves: [A2, A6, A8]
    files:
      - src/ledger.ts
      - src/plan.ts
      - src/cli.ts
      - package.json
      - tsconfig.json
    interfaces:
      consumes:
        - "validateMission(dir)"
      produces:
        - "appendEvent(event): void"
        - "readLedger(missionDir): Event[]"
        - "buildPacket(missionDir, taskId): Packet"
        - "coverage(plan, ledger): Map<acceptanceId, taskIds>"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
  - id: T-003
    title: Verify and gate registry
    deps: [T-002]
    risk: medium
    status: todo
    serves: [A3]
    files:
      - src/gates.ts
      - src/verify.ts
      - scripts/validate-mission.mjs
      - test/gates.test.ts
    interfaces:
      consumes:
        - "readLedger(missionDir)"
      produces:
        - "runGate(gate): GateResult"
        - "verifyTask(missionDir, taskId): VerifyResult"
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: fixture
        command: node
        args: ["scripts/validate-mission.mjs", "--expect-invalid", "test/fixtures/missing-gate"]
        severity: block
  - id: T-004
    title: Generic adapter and dispatch packet
    deps: [T-003]
    risk: low
    status: todo
    serves: [A3, A7]
    files:
      - docs/adapter.md
      - templates/dispatch.md
      - src/packet.ts
      - test/packet.test.ts
    interfaces:
      consumes:
        - "buildPacket(missionDir, taskId)"
      produces:
        - "renderDispatch(packet): string"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: packet
        command: node
        args: ["--test", "test/packet.test.ts"]
        severity: block
  - id: T-005
    title: Self-host the first tick
    deps: [T-004]
    risk: low
    status: todo
    serves: [A3, A4, A5, A7]
    files:
      - docs/self-hosting.md
      - missions/000-bootstrap/ledger.jsonl
    interfaces:
      consumes:
        - "cairn next"
        - "cairn verify"
        - "cairn record"
      produces:
        - "a task delivered with no manual ledger edit"
        - "a passing milestone audit recorded as review_result"
    gates:
      - id: reconcile
        command: node
        args: ["scripts/validate-mission.mjs", "missions/000-bootstrap"]
        severity: block
---

# Plan — Mission #0

Amended 2026-10-31: every task declares `serves`; `T-002` adds acceptance coverage and
`mission_amended`; `T-003` uses `--expect-invalid`; `T-005` includes the milestone audit. The
amendment is recorded in the ledger as a ruling with old and new hashes.

A task is the smallest unit that carries its own gate, commit, and acceptance link. Do them in
order; each one's interface block is what the next task may rely on.

## T-001 — Protocol schema and validator

**Goal:** Make the protocol machine-checkable before any runtime code exists.

**Status:** delivered; see `evidence/T-001/validate.json` and the ledger's `task_done`.

**Deliverable:** a zero-dependency Node ESM script `scripts/validate-mission.mjs` that
validates one mission directory:

- required frontmatter fields on `mission.md`, `policy.md`, `plan.md`;
- task ids unique, dependencies resolvable, status in `todo | active | review | done | parked`;
- every task has at least one `severity: block` gate;
- `ledger.jsonl` parses as one JSON object per line, with known event names;
- every `task_done` event names `base`, `head`, and at least one blocking gate at exit 0;
- every evidence path named by the ledger exists.

Add a `package.json` with `"type": "module"` and no dependencies. No TypeScript yet.

**Gate:** `node scripts/validate-mission.mjs missions/000-bootstrap`

**Done when:** the command exits 0 on this mission, and exits non-zero on a fixture with a
task that has no gate. Delivered with `test/validate-mission.test.mjs` (12 checks) and
`test/fixtures/missing-gate/`.

## T-002 — Ledger and CLI skeleton

**Goal:** One writer for the ledger, a legible plan, and an explicit acceptance map.

**Deliverable:** `src/ledger.ts`, `src/plan.ts`, `src/cli.ts`, `tsconfig.json`. Commands:

- `cairn status [--json]` — task states derived from the ledger, plus the acceptance coverage
  map (`A# → task ids`); an uncovered criterion is reported, not hidden;
- `cairn next` — the first task not done in the ledger whose dependencies are done, as a
  dispatch packet on stdout; exit 2 when none;
- `cairn record <task> --status done` — refuses unless a commit exists, a blocking gate at
  exit 0 is recorded, the task declares `serves` with a valid acceptance id, and the task's
  evidence files exist.

`appendEvent` is the only write path. It appends one line and fsyncs. It supports
`mission_amended` (old/new hashes, acceptance, why, approved_by) and rejects non-monotonic
`ts`.

**Gate:** `pnpm typecheck` and `node --test`

**Done when:** `cairn record T-002 --status done` refuses because T-002 has no evidence yet,
the refusal names the missing condition, and `cairn status --json` prints a coverage map where
every acceptance criterion is either covered or explicitly reported as missing.

## T-003 — Verify and gate registry

**Goal:** The runtime runs gates itself; implementer reports are not evidence.

**Deliverable:** `src/gates.ts`, `src/verify.ts`, and tests. `cairn verify <task>`:

- reads the task's gates from `plan.md`;
- runs each as a fixed argv with a timeout and an output cap;
- writes `evidence/<task>/<gate>.json` (command, argv, exit code, duration, tail);
- appends one `gate_result` per gate;
- exits 2 if any blocking gate failed.

Also add `--expect-invalid` to `scripts/validate-mission.mjs`: it exits 0 when the mission is
rejected and 1 when it is accepted, so a deliberately invalid fixture can be a blocking gate.

Advisory gates are recorded but never change the exit state.

**Gate:** `node --test` plus `node scripts/validate-mission.mjs --expect-invalid
test/fixtures/missing-gate`.

**Done when:** a failing gate writes exit 1, `cairn record` still refuses, an advisory failure
does not block, and the invalid fixture passes because it is rejected.

## T-004 — Generic adapter and dispatch packet

**Goal:** Any coding agent can execute a task from a file, with no Cairn-specific runtime.

**Deliverable:** `docs/adapter.md`, `templates/dispatch.md`, `src/packet.ts`. The packet
contains the mission goal, the acceptance criteria the task serves (`serves`), policy,
constraints, gates, ledger tail, and base commit. The adapter contract returns the report JSON
defined in `docs/protocol.md`; it never writes the ledger.

**Gate:** `pnpm typecheck` and `node --test test/packet.test.ts`

**Done when:** `cairn next` output validates against the documented packet schema, the packet
names the acceptance criterion the task serves, and a human can hand `templates/dispatch.md` to
a different coding agent and get a report back.

## T-005 — Self-host the first tick

**Goal:** Prove the protocol can carry its own development, including goal fidelity.

**Deliverable:** `docs/self-hosting.md` written through the loop: `cairn next` selects T-005, a
fresh agent executes from the packet, `cairn verify` runs the gate, `cairn record` appends
`task_done`. No manual ledger edit. Then run the milestone audit from
`docs/drift-control.md` and record it as `review_result`.

**Gate:** `node scripts/validate-mission.mjs missions/000-bootstrap`

**Done when:** the ledger contains `task_started`, `gate_result`, `review_result`, and
`task_done` for T-005; `cairn status` shows the mission complete; the cold-start test passes (a
fresh session names the next task, gate, and reason from the repository alone); and the audit
verdict is `pass`.

## Review Focus

The failure modes most likely to bite, each owned by a task's tests:

1. **Ledger/commit divergence** — a `task_done` without a commit, or a commit without an
   event. T-002 must refuse it; T-005 must reconcile it.
2. **Adapter writes the ledger** — two writers, duplicated events. T-004's contract says the
   adapter returns a report only; T-005 proves it.
3. **A gate that cannot fail** — an always-zero command that makes every task look done.
   T-003 needs a fixture that fails.
4. **Windows paths and case** — `C:\` vs `/`, case-insensitive file systems, line endings.
   T-001 and T-003 run on win32 first; `.gitattributes` pins LF.
5. **Ledger ordering and timestamps** — concurrent appends or clock skew. T-002 fsyncs and
   rejects non-monotonic `ts`.
6. **Goal drift** — a task with no `serves`, an uncovered acceptance criterion, or a silent
   target edit. T-002 checks coverage and amendments; T-005 runs the audit.
