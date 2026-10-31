# Cairn

> Leave a trail, not a transcript.

[中文](README.zh-CN.md) · English is canonical for the contract; the Chinese companion is a
translation. The language policy is in [`docs/i18n.md`](docs/i18n.md).

We are turning "building a product" from a conversation-bound craft into a repeatable,
auditable, self-iterating way of working. Cairn is the first artifact of that work.

The method fuses two existing packs:

- **superpowers** — process: skills, subagent workflows, execution discipline.
- **Impeccable** — standards: design and critique criteria.

The goal is to build products — docs, code, workflows — faster and with a higher floor, and to
make long-horizon work stable when no human is watching. Cairn is the runtime and evidence
layer: it carries a mission across sessions, proves completion from the repository, and keeps
the goal visible while the plan evolves.

The method is tested on itself. Mission #0 built Cairn with Cairn: a manual step was replaced
by a command only once the command existed and a gate proved it. If the protocol cannot
express its own delivery, the protocol is wrong.

Success is not "the gates are green". Success is:

- a fresh session, given only this repository, continues the mission without the prior
  conversation; and
- a milestone audit confirms the work still serves the goal, not just the plan.

Status: pre-alpha. Mission #2 (completion integrity) is active; the ledger is the status:
`.cairn/missions/002-completion-integrity/ledger.jsonl`. Mission #0 and Mission #1 are complete;
their `mission_done` events and acceptance evidence are in their ledgers.

## Model

- **Mission** — bounded work with acceptance criteria.
- **Task** — the smallest unit with its own gate, commit, and acceptance link.
- **Tick** — one transaction; at most one task.
- **Gate** — a deterministic command; its exit code is the verdict.
- **Ledger** — append-only JSONL; the only truth.
- **State** — `.cairn/missions/<id>/`, committed except `.cairn/cache/`.

A task is done only when a commit exists, a blocking gate exited 0, and `task_done` is in the
ledger. Implementer claims are not evidence.

## Positioning

Cairn sits between the harness and the packs:

- **Above the harness**: ZCode is the first execution environment; the contract, ledger, and
  evidence format are harness-neutral. Adapters execute; Cairn records (`T-004`).
- **Inside git**: commits and the ledger are the durable state; every cache is rebuildable.
- **Beside the packs**: superpowers says how to work, Impeccable says what good looks like,
  Cairn says what counts as done and whether the goal still holds.

The first user is the author: prove it here before generalizing.

It is not an agent, an orchestrator, a prompt pack, a chat UI, a hosted service, or a merge of
the two source repositories.

## Start here

1. Read [`docs/protocol.md`](docs/protocol.md).
2. Read [`docs/workflow.md`](docs/workflow.md) for the one-tick operator flow: roles, steps,
   human checkpoints, and failure paths.
3. Read [`.cairn/missions/002-completion-integrity/`](.cairn/missions/002-completion-integrity/).
4. The ledger is the status:
   [`ledger.jsonl`](.cairn/missions/002-completion-integrity/ledger.jsonl).
5. Run the current gate:
   `node scripts/validate-mission.mjs .cairn/missions/002-completion-integrity`.
6. Run `node scripts/goal-check.mjs --anchor` before starting work. It names the next task, the
   acceptance criterion it serves, and the gates. The SessionStart hook runs the same command
   once the workspace is trusted; until then run it by hand.
7. Run `node scripts/audit-session.mjs` before claiming completion. It reads the actual
   transcript and reports drift signals; a claim without a gate in the same turn is one.

The repository is designed to be self-contained: a new session should resume from the files
alone. That property is tested at every milestone, not assumed. The self-observation tools are
documented in [`docs/automation.md`](docs/automation.md).

## Non-goals

- Not a prompt pack.
- Not a vendor orchestrator.
- Not a chat UI.
- Not a hosted service.
- Not a merge of superpowers or Impeccable into this repository.

## License

MIT. See [`LICENSE`](LICENSE).
