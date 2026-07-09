## General

- A collection of educational code modules for comparison: Node.js & Python (Rust is used for Solana blockchain
  programs).
- Local infrastructure is run with Docker - a local Solana validator and some databases.
- GitHub Actions for CI - QA checks against equivalent infrastructure in the cloud.
- This project, called `ff`, will continue to narrow its focus on blockchain development (this is what I want to learn
  most).
- Blockchain programs are built with Solana & Rust with the help of the Anchor framework; located in
  `./fragments/blockchain/solana/programs/`.
- Each programming language has its own API to interface with the various modules of code; located in
  `./fragments/apis/`.
- AWS IaC is managed with Terraform; located in `./fragments/terraform/`. One directory per HCP Terraform workspace
  (`ff_dev/` uses local execution, `ff_prod/` uses remote execution). Shared modules live in
  `./fragments/terraform/modules/`. State backend is HCP Terraform; the `cloud {}` block omits `organization` so the
  config is portable — the org name is supplied via the `TF_CLOUD_ORGANIZATION` env var.
- Architectural decisions are recorded as MADR-style markdown ADRs in `./fragments/adrs/`. ADRs are immutable once
  accepted - supersede with a new record rather than editing an existing one. Spin up new records with the `/new-adr`
  skill (`.claude/skills/new-adr/`), which assigns the next zero-padded, never-reused `NNN` and updates the README
  index.
- Bruno CLI is used for integration testing against each API; located in `./fragments/apis/bruno/`.
- Unit tests and integration tests run against the infrastructure and deployed Solana programs (see the `spec-build`
  skill for commands).
- Integration tests (with Bruno) require the relevant API to be running (see the `spec-build` skill for commands).
- I'm a software craftsman by trade and my software experience and skills are mostly in TypeScript and Node.js, so
  that's how I tend to frame my understanding and comparisions with Python and any other programming language.
- I want to reposition myself as a platform engineer who designs, creates and maintains cloud-based infrastructure in
  AWS. Technologies TBC, but probably python, k8s (using EKS in AWS), Terraform (and / or Pulumi for comparision),
  GitOps & ArgoCD.
- As a side quest, I want to learn more about programming on blockchains and how to develop and interact with them
  through code interfaces and UI interfaces (including wallets). I'm planning to focus on the Solana blockchain for now.

## Implementation & QA

- **Before writing, building, upgrading, or QA-ing any code, load the `build` skill** (`.claude/skills/build/`). It is
  the authoritative home for this repo's common commands (test / lint / format / build / run) and coding conventions
  across Node.js, Python, Rust/Anchor, Terraform and Bruno.
- New features follow the custom spec-driven workflow — three skills in `.claude/skills/`:
  - `spec-ideate` → capture the product ask as `specs/NNN_feature_slug/requirements.md` (grills the idea first).
  - `spec-tasks` → split the requirements into deliverable per-task files under `specs/NNN_feature_slug/tasks/`.
  - `spec-build` → implement the tasks one at a time, verifying each independently (composes the `build` skill).
- Specs live under `./specs/` (one numbered directory per feature); see [`specs/README.md`](../specs/README.md).

## Modules (aka fragments)

- Node.js API entry file: `./fragments/api.ts`.
- Python API entry file: `./fragments/api.py`.
- Blockchain programs (only Solana atm): `./fragments/blockchain/solana/programs/`.
- Terraform workspace roots (one per HCP workspace): `./fragments/terraform/ff_dev/`, `./fragments/terraform/ff_prod/`.
  Shared modules: `./fragments/terraform/modules/`.
- ADRs / decision records: `./fragments/adrs/`.
- Feature specs: `./specs/` (spec-driven workflow).
