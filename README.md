# Cairn

> Leave a trail, not a transcript.

We are turning "building a product" from a conversation-bound craft into a repeatable,
auditable, self-iterating way of working. Cairn is the first artifact of that work.

The method fuses two existing packs:

- **superpowers** — process: skills, subagent workflows, execution discipline.
- **Impeccable** — standards: design and critique criteria.

The goal is to build products — docs, code, workflows — faster and with a higher floor, and to
make long-horizon work stable when no human is watching. Cairn is the runtime and evidence
layer: it carries a mission across sessions, proves completion from the repository, and keeps
the goal visible while the plan evolves.

The method is tested on itself. Mission #0 builds Cairn with Cairn. If the protocol cannot
express its own delivery, the protocol is wrong.

Success is not "the gates are green". Success is:

- a fresh session, given only this repository, continues the mission without the prior
  conversation; and
- a milestone audit confirms the work still serves the goal, not just the plan.

Status: pre-alpha. Mission #0 is in progress.

## Model

- **Mission** — bounded work with acceptance criteria.
- **Task** — the smallest unit with its own gate, commit, and acceptance link.
- **Tick** — one transaction; at most one task.
- **Gate** — a deterministic command; its exit code is the verdict.
- **Ledger** — append-only JSONL; the only truth.

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
2. Read [`missions/000-bootstrap/`](missions/000-bootstrap/).
3. The ledger is the status: [`ledger.jsonl`](missions/000-bootstrap/ledger.jsonl).
4. Run the current gate: `node scripts/validate-mission.mjs missions/000-bootstrap`.

The repository is designed to be self-contained: a new session should resume from the files
alone. That property is tested at every milestone, not assumed.

## Non-goals

- Not a prompt pack.
- Not a vendor orchestrator.
- Not a chat UI.
- Not a hosted service.
- Not a merge of superpowers or Impeccable into this repository.

## License

TBD.
