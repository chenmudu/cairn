# Code standard

- Source: Cairn floor; Impeccable 4.8.0+df3a4ab for interface criteria, not for the detector
  on non-UI code.
- Pin: cairn/standards@0.1; Impeccable skill 4.8.0 / engine 0.1.18 / source df3a4ab.

## Change

- One task per tick. The diff contains the smallest change that satisfies the task.
- Write the test first. See it fail for the expected reason, then make it pass.
- Do not refactor unrelated code, rename historical artifacts, or reformat a file to match a
  new preference. If a neighboring defect blocks the task, record it; do not expand the diff.
- Prefer removing a special case to adding a branch. More than three levels of indentation is
  a design signal, not a formatting problem.

## Proof

- A blocking gate exits 0, its evidence file exists, and the ledger carries the result.
- A commit message is not evidence. A green gate proves the step, not the mission.
- Every fallback is executable. A comment that says "handle this later" is not a fallback.

## Shape

- Functions are short and named for what they return or change. A boolean parameter that
  switches behavior usually means two functions.
- Errors name the failing input and the next action. Do not swallow an error to keep a run
  green.
- Types and schemas are explicit at boundaries. Do not guess a shape from a sample.

## Impeccable

- `detect` scans markup and URLs only. It is `not-applicable` to TypeScript, scripts, and
  markdown; an empty result is not a pass.
- When a change produces a rendered surface, run `detect` and `critique` on that surface and
  record the command and the result.
- For non-UI code, use the same criteria on the interfaces a human reads: error messages,
  CLI output, and file names.
