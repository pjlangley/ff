## General

- A polyglot of educational code modules for comparison: Node.js, Python, Rust & Go.
- Local infrastructure is run with Docker - a local Solana validator and some databases.
- GitHub Actions for CI - QA checks against equivalent infrastructure in the cloud.
- This project, called `ff`, will continue to narrow its focus on blockchain development (this is what I want to learn
  most).
- Blockchain programs are built with Solana & Rust with the help of the Anchor framework; located in
  `./fragments/blockchain/solana/programs/`.
- Each programming language has (or will have) its own API to interface with the various modules of code; located in
  `./fragments/apis/`.
- Bruno CLI is used for integration testing against each API; located in `./fragments/apis/bruno/`.
- Unit tests and integration tests run against the infrastructure and deployed Solana programs (see "Common commands"
  section).
- Integration tests (with Bruno) require the relevant API to be running (see "Common commands" section).
- I'm a software craftsman by trade and my software experience and skills are mostly in TypeScript and Node.js, so
  that's how I tend to frame my understanding and comparisions with Go, Rust, Python and any other programming language.
- I want to learn more about programming on blockchains and how to develop and interact with them through code
  interfaces and eventually UI components, like wallets. I'm happy to focus on the Solana blockchain for now.

## Common Commands

- `docker compose --profile blockchain up` - runs the local infrastructure (this is normally up and running when I'm
  working with Claude Code).
- `fnm` used for local Node.js, and version is specified in `.nvmrc`.
- `node --run test` - runs the Node.js unit tests.
- `pyenv` and `venv` used for local Python.
- `source .venv/bin/activate` to activate the virtual environment.
- `python -m unittest -v` runs the Python unit tests.
- `cargo` for local Rust.
- `cargo test -- --test-threads=1` for the Rust unit tests (sequentially until I do some refactoring to make parallelism
  work).
- `goenv` used for local Go.
- `goenv exec go test -v -p 1 ./fragments/...` for the Go unit tests (sequentially until I do some refactoring to make
  parallelism work).
- `node --run api` to run the local Node.js API.
- `node --run api:bru:fastify` to run the Bruno integration tests against the running Fastify API.
- `cargo run --bin api` to run the local Rust API.
- `node --run api:bru:axum` to run the Bruno integration tests against the running Axum API.
- `goenv exec go run fragments/api.go` to run the local Go API.
- `node --run api:bru:gin` to run the Bruno integration tests against the running Gin API.
- `python -m fragments.api` to run the local Python API.
- `node --run api:bru:fastapi` to run the Bruno integration tests against the running FastAPI API.
- `solana` and `anchor` CLI commands are available locally.
- Further Rust commands and anchor CLI commands available once you change directory into
  `./fragments/blockchain/solana/`, e.g.:
  - `anchor test --skip-deploy --skip-local-validator` runs the (Node.js) unit tests.
  - `anchor build` to build all programs.

## Conventions

- Node.js code is formatted and linted with Deno; config in `./deno.json`.
- Node.js code is written in TypeScript and uses `tsc` to build (see `./tsconfig.json`) the core fragments.
- Node.js API is locally run with `tsx` and uses `./tsconfig.api.json`.
- Node.js formatting, linting and TypeScript check tasks are also applied to the Solana program unit test files in
  `./fragments/blockchain/solana/tests/`.
- Local Solana validator settings in `./solana-cli.local.yml` (you do not have permission to read the referenced
  `./solana.id.json` key file though).
- Python code is type-checked with `mypy`, see `./mypi.ini`.
- Python code is linted with `pylint`, see `./pylintrc`.
- Python code is formatted with `black`, see `./pyproject.toml`.
- Rust code is linted with `clippy` and formatted with `cargo fmt`.
- Go code is linted with `golangci-lint`, see `./.golangci.yaml`.
- Go code is formatted with `gofmt -w ./fragments`.
- Core fragments have access to environment variables that specify the locally running Solana program IDs - see
  `./solana_program_keys/solana_program_keys.env`.
- Production-grade code with a pragmatic understanding that this is for educational purposes. For example, I made a
  trade-off by using ephemeral in-memory keypairs in the API interfaces that operate on the Solana programs, i.e. in
  `./fragments/apis/fastify/blockchain/solana_username.ts`.
- Prefer snake case for file and directory names.

## Modules (aka fragments)

- `./rust-toolchain.toml` for the core Rust fragment dependencies, but
  `./fragments/blockchain/solana/rust-toolchain.toml` for the blockchain program dependencies.
- Node.js API entry file: `./fragments/api.ts`.
- Python API entry file: `./fragments/api.py`.
- Rust API entry file: `./fragments/api.rs`.
- Go API entry file: `./fragments/api.go`.
- Blockchain programs (only Solana atm): `./fragments/blockchain/solana/programs/`.
