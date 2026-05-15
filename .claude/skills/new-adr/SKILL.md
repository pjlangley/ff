---
name: new-adr
description: Create a new MADR-style architectural decision record in fragments/adrs/. Use when the user asks to draft, write, add, record, or create a new ADR / decision record / architectural decision. Computes the next zero-padded NNN, writes the file with the canonical structure, and appends a row to the README index table.
---

# new-adr

Create a new architectural decision record in `fragments/adrs/` and update the README index in one step.

## When to use

Invoke when the user asks to create / draft / write / record an architectural decision. If the decision is already
described in the conversation, draft from that context. Otherwise ask one consolidated question for: title, the chosen
option, and a brief context — then proceed.

## Procedure

1. **Compute the next number.** List `fragments/adrs/`, find the highest existing `NNN_*.md`, add one, zero-pad to three
   digits. Numbers are never reused — even if a previous ADR was rejected or deleted, do not fill its slot.
2. **Derive the filename.** `NNN_title_with_underscores.md` — snake_case, ASCII only, drop punctuation.
3. **Default the metadata.** `Status: Accepted` and `Date:` = today's actual date (`YYYY-MM-DD`) unless the user says
   otherwise. Other valid statuses: `Proposed`, `Rejected`, `Deprecated`, `Superseded by [NNN](NNN_title.md)`.
4. **Write the file** at `fragments/adrs/NNN_title_with_underscores.md` using the canonical structure below. Include
   `### Consequences` and `## More Information` unless the user explicitly asks to omit them — both are optional but
   usually present.
5. **Update the README index.** Append a new row to the `| ADR | Date | Status |` table under `## Decision records` in
   `README.md`, linking to the new file.
6. **Format.** Run `deno fmt fragments/adrs/<new-file>.md README.md`.
7. **Report back** with the new file path and a one-line note that the README index was updated.

## Canonical ADR structure

Produce a file matching this shape (the leading `#` is the title, not a section break):

```markdown
# {Short title — the solved problem and chosen solution}

**Status:** {Accepted | Proposed | Rejected | Deprecated | Superseded by [NNN](NNN_title.md)} | **Date:** {YYYY-MM-DD}

## Context and Problem Statement

{Two or three sentences. Make the scope of the decision explicit — point at the components/connectors involved.
Articulating it as a question is fine.}

## Considered Options

- {option 1}
- {option 2}
- ...

## Decision Outcome

Chosen option: "{...}", because {justification — the decisive criterion or the force it resolves}.

### Consequences

- Good, because {positive consequence}
- Bad, because {negative consequence}
- ...

## More Information

{Optional. Links to relevant code/docs, follow-up actions, or a Mermaid diagram. House style for diagrams uses
`config: { look: handDrawn }` to match the README. Diagrams may also sit inline above wherever they aid understanding.}
```

## Conventions to honour

- ADRs are **immutable once accepted** — never edit a past ADR's substance. To change a decision, write a new ADR with
  `Status: Accepted` whose body explains the change, and update the older ADR's status line to
  `Superseded by [NNN](NNN_title.md)`. Status updates and typo fixes are the only acceptable edits.
- **Numbering** is zero-padded and never reused.
- **Filenames** and directory names are snake_case (project-wide convention).
- Use the **bold metadata line** under the title (this repo's house style), not YAML frontmatter.

## Out of scope

- Auto-rewriting a superseded ADR's status. If the new ADR supersedes an older one, mention the older ADR's number in
  your report so the user can update it manually.
