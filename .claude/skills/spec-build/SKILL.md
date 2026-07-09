---
name: spec-build
description: Work through an already-planned spec feature by delivering the tasks in specs/NNN_feature_slug/tasks/ one at a time, verifying each independently. Use ONLY when such a tasks/ directory exists and the user is executing it; for ad-hoc, one-off, or any non-spec code change use the build skill instead. Composes the build skill for commands and conventions. Step 3 of the spec-driven workflow.
---

# spec-build

Drives spec-driven, per-task delivery. This is step 3 of the workflow: `spec-ideate` → `spec-tasks` → `spec-build`.

## When to use

**Only** when a `specs/NNN_feature_slug/tasks/` directory already exists (produced by `spec-tasks`) and the user is
working through that task list — delivering the tasks one at a time so each can be verified independently. For any other
code change — ad-hoc fixes, upgrades, one-off implementation not tied to a spec — use the `build` skill instead.

## Follow the `build` skill

For all repo commands (test / lint / format / build / run) and coding conventions, use the **`build`** skill — this
skill does not restate them. `build` is the general reference; `spec-build` only adds the per-task delivery loop below.

## Per-task delivery loop

Deliver **one task at a time** and let the user verify each independently:

1. Pick the next unchecked task from `specs/NNN_feature_slug/tasks/README.md`.
2. Work directly on `main` — no feature branch (solo portfolio repo).
3. Implement **only that task's scope**, following the `build` skill's commands and conventions.
4. Run the task's QA (tests / lint / format / typecheck for the languages touched — see the `build` skill).
5. Tick the task off in `tasks/README.md` and set its `Status: Done`.
6. **Stop and hand back with the changes left unstaged.** Do not commit or push. The user reviews the diff, then
   commits/pushes and verifies independently. Only continue to the next task on the user's explicit go-ahead.

## Out of scope

- Restating build/QA commands or conventions — those live in the `build` skill.
- No feature branches, **no staging or committing**, no pushing, no PR creation.
- No batching multiple tasks in one go — wait for the user's go-ahead between tasks.
