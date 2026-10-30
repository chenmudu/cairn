# Cairn

> Leave a trail, not a transcript.

Cairn is a git-native mission runtime for long-horizon coding work. It makes progress a
property of the repository instead of a property of the conversation: every completed task
leaves a commit, gate evidence, and a ledger event that any agent, session, or machine can
pick up.

Status: pre-alpha. Mission #0 builds Cairn with Cairn.

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

## Start here

1. Read [`docs/protocol.md`](docs/protocol.md).
2. Read [`missions/000-bootstrap/`](missions/000-bootstrap/).
3. The first tick is `T-001` in [`plan.md`](missions/000-bootstrap/plan.md).

The repository is designed to be self-contained: a new session should be able to resume from
the files alone, without this conversation.

## Non-goals

- Not a prompt pack.
- Not a vendor orchestrator.
- Not a chat UI.
- Not a hosted service.

## License

TBD.