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
  (`ff_dev/` uses local execution, `ff_prod/` will use remote execution). Shared modules live in
  `./fragments/terraform/modules/`. State backend is HCP Terraform; the `cloud {}` block omits `organization` so the
  config is portable — the org name is supplied via the `TF_CLOUD_ORGANIZATION` env var.
- Bruno CLI is used for integration testing against each API; located in `./fragments/apis/bruno/`.
- Unit tests and integration tests run against the infrastructure and deployed Solana programs (see "Common commands"
  section).
- Integration tests (with Bruno) require the relevant API to be running (see "Common commands" section).
- I'm a software craftsman by trade and my software experience and skills are mostly in TypeScript and Node.js, so
  that's how I tend to frame my understanding and comparisions with Python and any other programming language.
- I want to reposition myself as a platform engineer who designs, creates and maintains cloud-based infrastructure in
  AWS. Technologies TBC, but probably python, k8s (using EKS in AWS), Terraform (and / or Pulumi for comparision),
  GitOps & ArgoCD.
- As a side quest, I want to learn more about programming on blockchains and how to develop and interact with them
  through code interfaces and UI interfaces (including wallets). I'm planning to focus on the Solana blockchain for now.

## Common Commands

- `docker compose --profile blockchain up` - runs the local infrastructure (this is normally up and running when I'm
  working with Claude Code).
- `docker compose --profile blockchain --profile api up` - runs the local infrastructure including the APIs.
- `fnm` used for local Node.js, and version is specified in `.node-version`.
- `node --run test` - runs the Node.js unit tests.
- `uv` used for local Python; config in `./pyproject.toml`.
- `uv run python -m unittest -v` runs the Python unit tests.
- `node --run api` to run the local Node.js API.
- `node --run api:bru:fastify` to run the Bruno integration tests against the running Fastify API.
- `uv run python -m fragments.api` to run the local Python API.
- `node --run api:bru:fastapi` to run the Bruno integration tests against the running FastAPI API.
- `solana` and `anchor` CLI commands are available locally.
- Further `anchor` CLI commands available once you change directory into `./fragments/blockchain/solana/`, e.g.:
  - `anchor test` (or `cargo test -p program-tests`) runs the Rust unit tests.
  - `anchor build` to build all programs.
- `terraform login` - one-time, authenticates against HCP Terraform.
- `TF_CLOUD_ORGANIZATION` must be set in the environment for any terraform command that contacts HCP (init, plan, apply,
  etc.) — the `cloud {}` block in code omits `organization` so it can be supplied here.
- Further `terraform` CLI commands available once you change directory into a workspace root, e.g.
  `./fragments/terraform/ff_dev/`:
- `terraform fmt -check -recursive ./fragments/terraform` - format check for all terraform code.

## Conventions

- Node.js code is formatted and linted with Deno; config in `./deno.json`.
- Node.js code is written in TypeScript and uses `tsc` to build (see `./tsconfig.json`) the core fragments.
- Node.js API is locally run with `tsx` and uses `./tsconfig.api.json`.
- Local Solana validator settings in `./solana-cli.local.yml` (you do not have permission to read the referenced
  `./solana.id.json` key file though).
- Python code is type-checked with `mypy`; config in `./pyproject.toml`.
- Python code is linted with `pylint`; config in `./pyproject.toml`.
- Python code is formatted with `ruff`; config in `./pyproject.toml`.
- Solana program Rust code is linted with `clippy` and formatted with `cargo fmt`.
- Solana program tests can be run with `cargo test -p program-tests` (uses LiteSVM).
- Terraform code is formatted with `terraform fmt` and validated with `terraform validate`.
- Terraform state is stored remotely in HCP Terraform; each workspace root directory binds to one HCP workspace via the
  `cloud` block in `main.tf`.
- `ff_dev` uses local execution; `ff_prod` will use remote execution (configured in the HCP workspace UI, not in code).
- Terraform AWS provider uses a `default_tags` block so every taggable resource automatically gets `Project` /
  `Environment` / `ManagedBy` tags. Don't duplicate these tags at the resource level.
- Resource names should be derived from `local.name_prefix` (`"${var.project}-${var.environment}"`) declared in each
  root module's `locals.tf`.
- `.terraform.lock.hcl` files are committed; `.terraform/`, `*.tfstate*`, and `*.tfvars` are ignored.
- Core fragments have access to environment variables that specify the locally running Solana program IDs - see
  `./solana_program_keys/solana_program_keys.env`.
- Production-grade code with a pragmatic understanding that this is for educational purposes. For example, I made a
  trade-off by using ephemeral in-memory keypairs in the API interfaces that operate on the Solana programs, i.e. in
  `./fragments/apis/fastify/blockchain/solana_username.ts`. Potentially come back to this if I end up with a CD workflow
  in AWS (e.g. use a secrets manager in the cloud instead)
- Prefer snake case for file and directory names.

## Modules (aka fragments)

- Node.js API entry file: `./fragments/api.ts`.
- Python API entry file: `./fragments/api.py`.
- Blockchain programs (only Solana atm): `./fragments/blockchain/solana/programs/`.
- Terraform workspace roots (one per HCP workspace): `./fragments/terraform/ff_dev/`, later
  `./fragments/terraform/ff_prod/`. Shared modules: `./fragments/terraform/modules/`.
