# Cairn

> Leave a trail, not a transcript.

Cairn is a git-native mission runtime for long-horizon coding work. It makes progress a
property of the repository instead of a property of the conversation: every completed task
leaves a commit, gate evidence, and a ledger event that any agent, session, or machine can
pick up.

Status: pre-alpha. Mission #0 builds Cairn with Cairn.

## Goal

The project began with a question about two existing packs:

- **superpowers** — process content: skills, subagent workflows, execution discipline.
- **Impeccable** — review criteria: design and critique standards.

Can they be fused into one way of working that raises the quality and speed of the products
built here — docs, code, and workflows — and then support unattended, long-horizon work that
still lands reliably?

Cairn is the runtime half of that answer. Rather than merging the two repositories, it builds
the layer that carries a mission and proves completion from the repository alone. The packs
are consumed by reference: superpowers supplies process, Impeccable supplies review criteria,
Cairn supplies evidence. See [decision 0002](docs/decisions/0002-packs-and-runtime-boundary.md).

The project tests the answer on itself. Mission #0 builds Cairn with Cairn; if the protocol
cannot express its own development, the protocol is wrong.

Success is not "the gates are green". Success is: a fresh session, given only this repository,
continues the mission without the prior conversation, and output quality does not drop.

## Why

Coding agents can finish a task in one session. They cannot reliably finish a project across
many sessions, context compactions, crashes, or harnesses. The missing piece is not a smarter
agent; it is durable state and independent verification.

A conversation can be compacted. A process can die. A harness can change. A commit, a gate
exit code, and an append-only ledger event survive all three.

## Model

- **Mission** — bounded work with acceptance criteria.
- **Task** — the smallest unit with its own gate and commit.
- **Tick** — one transaction; at most one task.
- **Gate** — a deterministic command; its exit code is the verdict.
- **Ledger** — append-only JSONL; the only truth.

A task is done only when a commit exists, a blocking gate exited 0, and `task_done` is in the
ledger. Implementer claims are not evidence.

## Start here

1. Read [`docs/protocol.md`](docs/protocol.md).
2. Read [`missions/000-bootstrap/`](missions/000-bootstrap/).
3. The ledger is the status: [`ledger.jsonl`](missions/000-bootstrap/ledger.jsonl). `T-001` is
   done; the next task is in [`plan.md`](missions/000-bootstrap/plan.md).
4. Run the current gate: `node scripts/validate-mission.mjs missions/000-bootstrap`.

The repository is designed to be self-contained: a new session should be able to resume from
the files alone, without this conversation.

## Non-goals

- Not a prompt pack.
- Not a vendor orchestrator.
- Not a chat UI.
- Not a hosted service.
- Not a merge of superpowers or Impeccable into this repository.

## License

TBD.
