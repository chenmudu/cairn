# Documentation standard

- Source: Cairn floor; Impeccable 4.8.0+df3a4ab for document-surface criteria
  (`critique`, `audit`, `polish`, `harden`).
- Pin: cairn/standards@0.1; Impeccable skill 4.8.0 / engine 0.1.18 / source df3a4ab.

## The reader

- A reader can act without asking a follow-up question: the goal, the next step, the command,
  and the pass condition are present.
- Every command is runnable as written from the directory the document names.
- A claim about behavior names its evidence: a file, a command, or a commit.

## Language

- English is canonical for machine-checked contracts. Every human-facing document has a
  Chinese companion; the companion never overrides the English file.
- No unexplained protocol jargon. Define a term the first time it decides an action.
- Do not repeat the same point in different words. A second sentence must add information.

## Structure

- One topic per section; one claim per paragraph.
- Keep the shortest form that still lets a reader verify the claim. Tables only when the
  content is genuinely comparative.
- Link to the source of truth instead of copying it. A copy is a second contract.

## Impeccable, criteria-based

- This repository has no rendered UI. The UI-only dimensions of `audit` (performance,
  responsive behavior, theme, implementation completeness) are `not-applicable`; record the
  reason.
- Use the wording criteria from `critique` and `polish`: hierarchy, clarity, restraint,
  consistency. Do not claim a detector run on markdown; `detect` returns `[]` and that is
  `not-applicable`, not clean.
- `harden` applies to error and empty states; for docs, the analogue is a missing input, a
  failed command, or an absent pack. Say what happens.
