---
name: spec-ideate
description: Capture a product idea as a requirements spec in specs/. Use when the user wants to ideate, start a new feature / spec, capture requirements, or plan a product ask. Grills the idea via the grilling skill, computes the next zero-padded NNN feature dir, writes requirements.md, and seeds the specs README index.
---

# spec-ideate

Turn a rough product ask into a `requirements.md` under `specs/NNN_feature_slug/`. This is step 1 of the spec-driven
workflow: `spec-ideate` → `spec-tasks` → `spec-build`.

## When to use

Invoke when the user wants to start a new feature, capture requirements, or "ideate" on a product idea. The input is a
product idea for planning purposes — not an implementation request.

## Procedure

1. **Grill first.** Apply the `grilling` skill to interrogate the idea: ask one question at a time, wait for each
   answer, and give a recommended answer per question. Look up _facts_ in the codebase yourself; only put genuine
   product _decisions_ to the user. Continue until you reach a shared understanding of the product ask.
2. **Compute the next number.** List `specs/`, find the highest existing `NNN_*` directory, add one, zero-pad to three
   digits. Numbers are never reused — even if a feature was abandoned, do not fill its slot.
3. **Derive the slug.** `NNN_feature_slug` — snake_case, ASCII only, drop punctuation.
4. **Write the file** at `specs/NNN_feature_slug/requirements.md` using the canonical structure below.
5. **Seed the index.** Append a row to the table in `specs/README.md` with `Status: Draft` and today's date.
6. **Format.** Run `deno fmt specs/NNN_feature_slug/requirements.md specs/README.md`.
7. **Report back** with the new path, and suggest running `spec-tasks` to break it into deliverable tasks.

## Canonical requirements.md structure

Produce a file matching this shape (the leading `#` is the title, not a section break):

```markdown
# {Feature title}

**Status:** Draft | **Created:** {YYYY-MM-DD}

## Problem / product ask

{What we're building and why — the user-facing outcome.}

## Users & goals

{Who benefits and what they achieve.}

## Requirements

- {functional requirements — what the feature must do}

## Non-goals / out of scope

- {explicit exclusions to keep scope tight}

## Acceptance criteria

- {observable, testable conditions that define "done"}

## Open questions

- {anything grilling could not resolve — or "none"}
```

## Conventions to honour

- Zero-padded, never-reused feature `NNN` (same rule as `new-adr`).
- Filenames and directory names are snake_case (project-wide convention).
- Use the **bold metadata line** under the title (house style), not YAML frontmatter, inside the spec body.
- `requirements.md` is the relatively stable source of truth — later skills read from it rather than rewriting it.

## Out of scope

- Splitting into tasks (that's `spec-tasks`) or writing any implementation code (that's `spec-build`).
