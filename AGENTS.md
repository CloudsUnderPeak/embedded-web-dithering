# Cautious Coding Guidelines

Use these guidelines as project-local behavioral guardrails. Bias toward caution over speed, while using judgment for trivial tasks.

## Project Spec Workflow

Before changing requirements, specs, or behavior expectations, read `docs/SPEC_INDEX.md` first.

- Update `docs/SPEC_BEHAVIOR.md` for user-visible product behavior, flows, UI behavior, milestones, and acceptance criteria.
- Update `docs/SPEC_TECHNICAL.md` for architecture, module boundaries, state, pipeline, storage, and implementation constraints.
- If a change affects both product behavior and implementation constraints, update both spec files and keep them consistent.

## Project Slash Commands

- `/docs`
  - Treat as a project-local documentation sync command.
  - Read `.codex/skills/docs/SKILL.md`.
  - Follow that workflow to summarize changes, update README language variants, and synchronize:
    - `docs/SPEC_INDEX.md`
    - `docs/SPEC_BEHAVIOR.md`
    - `docs/SPEC_TECHNICAL.md`

- `/commit`
  - Treat as a project-local staged commit command.
  - Read `.codex/skills/staged-commit/SKILL.md`.
  - Only inspect and commit staged changes.
  - Do not run `git add` for plain `/commit`.
  - Use commit messages in `[Add] summary`, `[Modify] summary`, or `[Fix] summary` format.
  - Use a concise commit-title summary.

- `/commit all`
  - Treat as the all-changes variant of `/commit`.
  - First run `git add --all` to stage all current changes.
  - Then continue with the same staged commit workflow.
  - Use commit messages in `[Add] summary`, `[Modify] summary`, or `[Fix] summary` format.
  - Use a concise commit-title summary.

## Think Before Coding

State assumptions explicitly before implementation when they affect the solution.

- Do not assume unclear requirements.
- Surface multiple plausible interpretations instead of silently choosing one.
- Name tradeoffs when a simpler or safer approach exists.
- Ask a clarifying question when ambiguity would make implementation risky.

## Prefer Simplicity

Write the minimum code that solves the requested problem.

- Do not add features beyond the request.
- Do not create abstractions for single-use code.
- Do not add configurability or flexibility unless requested or already required by the local design.
- Do not add error handling for impossible scenarios.
- If the implementation is much longer than the problem warrants, simplify it before finishing.

Use this check: would a senior engineer consider the change overcomplicated? If yes, reduce it.

## Make Surgical Changes

Touch only the lines needed for the user request.

- Do not improve adjacent code, comments, or formatting opportunistically.
- Do not refactor unrelated code.
- Match existing style, even when a different style would be preferable.
- Mention unrelated dead code or issues instead of deleting them.
- Remove only imports, variables, functions, or files that your own changes made unused.

Every changed line should trace directly to the user's request.

## Execute Toward Verification

Turn the task into verifiable goals and loop until checked.

- For bug fixes, reproduce the bug with a focused test or command when feasible, then make it pass.
- For validation work, cover invalid inputs and expected behavior.
- For refactors, verify behavior before and after when practical.
- For multi-step tasks, state a short plan where each step includes a verification check.

Use this shape for non-trivial plans:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

If success criteria are weak or impossible to verify locally, state the gap clearly.
