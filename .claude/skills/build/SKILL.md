---
name: build
description: Authoritative commands and conventions for building and QA-ing code in this repo (Node.js, Python, Rust/Anchor, Terraform, Bruno). Use for ANY code change — editing, building, upgrading, linting, testing, formatting — including one-off and ad-hoc work that is not part of a spec feature. This is the general reference and the default; it is not tied to the spec-driven workflow.
---

# build

The single source of truth for **how to build and verify code in this repo**. Consult it before and while changing any
code. It is used directly for everyday work (e.g. "fix this lint error", "upgrade Node to v24") and is composed by the
`spec-build` skill during spec-driven, per-task delivery.

## When to use

The default for **any** code change anywhere in the repo — editing, building, upgrading, linting, testing, formatting —
including one-off and ad-hoc work. This is the skill to reach for unless you are explicitly working through a planned
spec feature's task list (in which case use `spec-build`, which composes this skill).

## Common commands

- `docker compose --profile blockchain up` - runs the local infrastructure (this is normally up and running).
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
- `ff_dev` uses local execution; `ff_prod` uses remote execution (configured in the HCP workspace UI, not in code).
- Terraform AWS provider uses a `default_tags` block so every taggable resource automatically gets `Project` /
  `Environment` / `ManagedBy` tags. Don't duplicate these tags at the resource level.
- Resource names should be derived from `local.name_prefix` (`"${var.project}_${var.environment}"`) declared in each
  root module's `locals.tf`.
- `.terraform.lock.hcl` files are committed; `.terraform/`, `*.tfstate*`, and `*.tfvars` are ignored.
- Core fragments have access to environment variables that specify the locally running Solana program IDs - see
  `./solana_program_keys/solana_program_keys.env`.
- Production-grade code with a pragmatic understanding that this is for educational purposes. For example, I made a
  trade-off by using ephemeral in-memory keypairs in the API interfaces that operate on the Solana programs, i.e. in
  `./fragments/apis/fastify/blockchain/solana_username.ts`. Potentially come back to this if I end up with a CD workflow
  in AWS (e.g. use a secrets manager in the cloud instead)
- Prefer snake case for file and directory names.

## API surface

- **Every capability a fragment exposes is surfaced on both APIs.** The rule is about the capability, not where it
  lives: whenever a fragment gains something a caller could reasonably want to do — a read, a write, a query, an action
  against whatever the fragment integrates with — it gets a route on Fastify (`./fragments/apis/fastify/`, registered in
  `app.ts`) **and** on FastAPI (`./fragments/apis/fastapi/`, `app.py`), with the same path, status codes and JSON shape
  — bigints stringified, malformed input answered `400` by both rather than one framework's native `422` (see the
  comment on `get_registration_by_index_route` in `./fragments/apis/fastapi/blockchain/solana_register.py`). Each new
  route gets cases in the co-located route test file (e.g. `solana_register.test.ts` / `test_solana_register.py`) and a
  Bruno request under `./fragments/apis/bruno/` that runs against both environments (`environments/fastify.bru`,
  `environments/fastapi.bru`). Today that covers the `solana_*_interface` fragments and the datastore modules; a new
  kind of fragment is covered by the same rule.
- **What to expose vs not.** If it is reusable beyond the feature that introduced it — expose it. Feature-specific
  orchestration and runtime wiring — a Lambda handler, a consumer loop, `readConfig` / `createAwsClients` in
  `./fragments/solana_register_sync/poller.ts` — is a deployment surface, not a capability; don't expose it. When a
  capability first appears _inside_ orchestration code (as the by-index read did in the poller), promote it into the
  fragment it belongs to, mirror it in the other language, and expose it: `GET /solana/register/index/:index`
  (`getRegistrationAccountByIndex` / `get_registration_account_by_index`) is the exemplar.

## Testing conventions

Decided in [ADR 013](../../../fragments/adrs/013_blockchain_tests_against_local_validator.md); the short version:

- **The chain is real.** Blockchain fragment tests (`*.test.ts`, `test_*.py`) are integration tests against the local
  validator — assume it is running (`docker compose --profile blockchain up`). Never mock `initRpcClient` /
  `init_rpc_client`, the `@solana/kit` or `solana-py` RPC clients, or the `solana_*_interface` fragments. A module that
  integrates with the chain is tested through the chain, against accounts the deployed program actually wrote.
- **AWS is mocked, at the SDK client boundary.** Inject the clients (see `PollerClients` in
  `./fragments/solana_register_sync/poller.ts`) and double them with `aws-sdk-client-mock` (Node.js) or the `boto3`
  equivalent (Python), so tests assert the commands, condition expressions and envelopes the module actually sends. Do
  not mock one level higher (a wrapper or interface) — that hides exactly the parts worth asserting.
- **Be frugal with the shared validator.** The runner executes files in parallel against one validator with slowed slots
  (`--ticks-per-slot 256`). Confine chain writes to `before` / `setUpClass` and keep them few; when bootstrapping a
  singleton PDA tolerate an `already in use` error; use a generous confirmation window whose result is asserted, not
  ignored. `./fragments/solana_register_sync/poller.test.ts` is the exemplar.
- **In the agent sandbox the validator is unreachable** (loopback `listen()` denied, Docker socket blocked). Run
  typecheck / lint / format yourself, then hand `node --run test` / `uv run python -m unittest -v` to the user and say
  so explicitly in the handback. Never report those tests as passing, and never work around it by mocking the chain.

## See also

- `spec-build` — drives spec-driven, per-task delivery and composes this skill for the commands and conventions above.
- `spec-tasks` — plans the API surface above into each task at task-split time, so routes are not retrofitted later.
- The spec-driven workflow: `spec-ideate` → `spec-tasks` → `spec-build`.
