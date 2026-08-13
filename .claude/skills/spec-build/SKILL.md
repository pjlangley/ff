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
skill does not restate them. `build` is the general reference; `spec-build` only adds the preflight and per-task
delivery loop below.

## Preflight the task against the code

Task files are written at planning time — potentially long before execution, and without opening the code. Their bullets
carry rationales ("it currently does X", "so that Y doesn't happen"), and the code moves underneath them. **Before
writing any code**, test the premises the task file asserts:

- **Claims about this repo's current state.** Open every file the `Changes` section names and confirm the described
  current behaviour is actually there.
- **Claims about third-party behaviour** — Anchor, GitHub Actions, Terraform, AWS semantics. Verify against the tool's
  documentation or a local command, **never from memory**. This is where a rationale is most often wrong and least
  likely to be noticed, because the code alone cannot falsify it.
- **Preconditions.** Every task in `Depends on` is `Status: Done`, the named paths exist, and no earlier task has
  already delivered part of the scope.

Apply the `grilling` skill's dividing line: **facts** are yours to look up, **decisions** are the user's. The preflight
tests falsifiable premises only.

### Reporting findings

- **Material** — the flaw would change what gets built. Stop before implementing. Report the premise as written, the
  evidence contradicting it, and a recommended alternative, then wait for the user's ruling.
- **Non-material** — stale wording, a path that moved, cosmetics. Note it, proceed, and mention it in the handback.

Where the ruling deviates from the task file, amend that file in the same change: strike the bullet through and state
what was done instead and why. A task marked `Done` must not still assert something known to be false.

## Per-task delivery loop

Deliver **one task at a time** and let the user verify each independently:

1. Pick the next unchecked task from `specs/NNN_feature_slug/tasks/README.md`.
2. **Preflight it against the code** (see above). Stop here if it turns up a material flaw.
3. Work directly on `main` — no feature branch (solo portfolio repo).
4. Implement **only that task's scope**, following the `build` skill's commands and conventions.
5. Run the task's QA (tests / lint / format / typecheck for the languages touched — see the `build` skill).
6. Tick the task off in `tasks/README.md` and set its `Status: Done`. If the preflight changed the plan, amend the task
   file in the same change to record what was done instead and why.
7. **Stop and hand back with the changes left unstaged**, listing any non-blocking preflight findings alongside the
   diff. Do not commit or push. The user reviews the diff, then commits/pushes and verifies independently. Only continue
   to the next task on the user's explicit go-ahead.

## Out of scope

- Restating build/QA commands or conventions — those live in the `build` skill.
- Re-grilling `requirements.md` or reopening settled design decisions — the preflight tests falsifiable premises, it is
  not a re-plan.
- No feature branches, **no staging or committing**, no pushing, no PR creation.
- No batching multiple tasks in one go — wait for the user's go-ahead between tasks.
