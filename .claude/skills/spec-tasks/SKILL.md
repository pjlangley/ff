---
name: spec-tasks
description: Split a feature's requirements.md into independently-deliverable tasks under specs/NNN_feature_slug/tasks/. Use when the user wants to break down, split, or plan tasks for a spec or feature. Writes one NN_task_slug.md per task ordered by dependency, and maintains a tasks/README.md checklist.
---

# spec-tasks

Split a feature's `requirements.md` into independently-deliverable, chronologically-ordered task files. This is step 2
of the spec-driven workflow: `spec-ideate` → `spec-tasks` → `spec-build`.

## When to use

Invoke when the user wants to break down / split / plan the tasks for an existing spec. Requires a
`specs/NNN_feature_slug/requirements.md` to already exist (produced by `spec-ideate`).

## Procedure

1. **Read the requirements.** Open `specs/NNN_feature_slug/requirements.md`. If the target feature is ambiguous, ask
   which one.
2. **Decompose into vertical slices.** Each task must be **deliverable on its own**: committable, QA-able, and
   verifiable independently, mapping back to the acceptance criteria. Avoid tasks that only make sense together.
3. **Order by dependency.** Sequence tasks so each can be completed and verified before the next. Number them `01_`,
   `02_`, … (zero-padded two digits).
4. **Write one file per task** at `specs/NNN_feature_slug/tasks/NN_task_slug.md` using the canonical structure below.
   `task_slug` is snake_case.
5. **Maintain the checklist.** Create/update `specs/NNN_feature_slug/tasks/README.md` — an ordered checklist of the
   tasks (`- [ ] 01 — {title}`) that `spec-build` ticks off as it goes.
6. **Update the index.** Set the feature's row in `specs/README.md` to `Status: Planned`.
7. **Format.** Run `deno fmt` on the new/changed files, then report and suggest running `spec-build`.

## Canonical task file structure

```markdown
# {NN — task title}

**Status:** Todo | **Feature:** [NNN_feature_slug](../requirements.md)

## Goal

{One deliverable outcome for this task.}

## Depends on

- {earlier task numbers this relies on, or "none"}

## Changes

- {files / modules / fragments to touch, at a high level}

## Verification (QA)

- {which commands from the build skill to run — e.g. `node --run test`, `uv run mypy`, `cargo clippy`, the relevant
  Bruno suite}

## Definition of done

- {checklist tying back to the requirements' acceptance criteria}
```

## Conventions to honour

- Zero-padded two-digit task numbers; snake_case filenames.
- Reference QA commands by name and defer to the `build` skill for their canonical form — don't duplicate the command
  list here.
- Keep tasks small enough to review as a self-contained diff.

## Out of scope

- Writing implementation code or running the tasks (that's `spec-build`).
- Rewriting `requirements.md` — treat it as the stable source of truth.
