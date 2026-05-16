---
name: staged-commit
description: Create a commit from staged changes. Use when the user invokes `/commit`, `/commit all`, `$staged-commit`, or asks Codex to inspect the staging area, generate a simple `[Add]` or `[Fix]` commit message, and commit staged changes. `/commit all` first stages all current changes.
---

# Staged Commit

Use this skill to commit the current staging area. `/commit all` is the only variant that stages files before committing.

## Rules

- For plain `/commit`, never run `git add`.
- For `/commit all`, run `git add --all` before inspecting the staged diff.
- Never include unstaged changes in a plain `/commit` commit.
- Inspect staged changes with `git diff --cached`.
- If there are no staged changes, stop and tell the user to stage files first.
- If unstaged changes exist, mention them after the commit plan or final commit summary, but do not modify them.
- If the staged diff mixes unrelated intentions, ask the user to split the staging area before committing.

## Message Format

Use this format:

```text
[type] summary
```

Allowed types:

- `[Add]`: new capability, new documentation, new config, new structure, new asset, or intentional expansion.
- `[Fix]`: bug fix, broken link fix, typo correction, behavior correction, or correction to existing documentation/config.

Prefer short English summaries:

```text
[Add] multilingual README
[Add] docs sync skill
[Fix] spec links
[Fix] crop overlay rotation
```

Use a concise commit-title summary. Do not end the summary with a period.

## Workflow

1. Run `git status --short`.
2. If the user invoked `/commit all`, run `git add --all`.
3. Run `git status --short`.
4. Run `git diff --cached --stat`.
5. Run `git diff --cached` and infer the main intent.
6. Choose `[Add]` or `[Fix]`.
7. Show the planned commit message if the user did not explicitly ask to skip confirmation.
8. Commit with exactly the staged changes:
   - `git commit -m "[Add] summary"`
   - or `git commit -m "[Fix] summary"`
9. Report the commit hash and mention any unstaged changes left behind.
