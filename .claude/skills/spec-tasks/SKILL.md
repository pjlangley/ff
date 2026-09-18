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
3. **Plan the API surface.** For every task that gives a fragment a new capability — anything a caller could reasonably
   want to do through the APIs, whatever kind of fragment it lands in — decide whether it is reusable beyond this
   feature per the `build` skill's API surface convention. If it is, the Fastify route, the FastAPI route, their route
   tests and the Bruno request belong in **that task's** `Changes` and `Verification (QA)` — not in a later catch-up
   task. If it is orchestration, say so in the task file so the decision is visible at build time.
4. **Order by dependency.** Sequence tasks so each can be completed and verified before the next. Number them `01_`,
   `02_`, … (zero-padded two digits).
5. **Write one file per task** at `specs/NNN_feature_slug/tasks/NN_task_slug.md` using the canonical structure below.
   `task_slug` is snake_case.
6. **Maintain the checklist.** Create/update `specs/NNN_feature_slug/tasks/README.md` — an ordered checklist of the
   tasks (`- [ ] 01 — {title}`) that `spec-build` ticks off as it goes.
7. **Update the index.** Set the feature's row in `specs/README.md` to `Status: Planned`.
8. **Format.** Run `deno fmt` on the new/changed files, then report and suggest running `spec-build`.

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
- {API surface: the Fastify + FastAPI routes and Bruno request exposing any new fragment capability — or "none —
  <why>", e.g. the change is orchestration only}

## Verification (QA)

- {which commands from the build skill to run — e.g. `node --run test`, `uv run mypy`, `cargo clippy`; whenever the API
  surface bullet above is not "none", the co-located route tests and the relevant Bruno suite by name}
- {which integrations the tests exercise for real and which are doubled, per the build skill's testing conventions: the
  chain is real against the local validator, AWS SDK clients are mocked}

## Definition of done

- {checklist tying back to the requirements' acceptance criteria}
```

## Conventions to honour

- Zero-padded two-digit task numbers; snake_case filenames.
- Reference QA commands by name and defer to the `build` skill for their canonical form — don't duplicate the command
  list here.
- Keep tasks small enough to review as a self-contained diff.
- Never plan a task around mocking the chain. The `build` skill's testing conventions (ADR 013) have blockchain RPC and
  the `solana_*_interface` fragments exercised against the local validator; only AWS SDK clients are doubled. A QA
  section that says otherwise is a material preflight finding in `spec-build`.
- Surface new fragment capabilities on both APIs (the `build` skill's API surface convention). Spec 001's task 07 wrote
  the by-index registration read privately inside the poller, and the interface function plus routes were retrofitted
  afterwards; planning the exposure into the task avoids that round trip. A requirements file saying "no public API" is
  about the feature's own surface — it does not exempt capabilities the feature adds to fragments.
- When a bullet's rationale asserts current behaviour — this repo's or a third-party tool's — look it up rather than
  writing it from memory (`grilling`'s rule: facts are yours to find, decisions are the user's). `spec-build` preflights
  these premises before implementing, and a wrong one costs a round trip.

## Out of scope

- Writing implementation code or running the tasks (that's `spec-build`).
- Rewriting `requirements.md` — treat it as the stable source of truth.
