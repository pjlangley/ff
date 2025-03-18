# Fullstack fragments

A collection of single responsibility code samples in a variety of programming languages for comparison, with an
emphasis on functional programming. What I call _fullstack fragments_.

For the _core_ fragments, the supported programming languages are:

- ✅ Node.js
- ✅ Python
- ✅ Rust
- ✅ Go

For the _blockchain_ programs, the supported chains and programming languages are:

- ✅ Solana with Rust

Every code sample is mirrored in each language, and each one implements these basic code quality tasks:

- Unit testing
- Linting
- Building / compiling, if applicable
- Formatting
- Type checking

Every sample in every language can be run both locally and via Docker. See _Running the code_ below.

## Code contents

1. Working with environment variables: [`fragments/env_vars`](./fragments/env_vars/)
1. Working with SQLite: [`fragments/sqlite_db`](./fragments/sqlite_db/)
1. Working with Redis: [`fragments/redis_db`](./fragments/redis_db/)
1. Working with PostgreSQL: [`fragments/postgres_db`](./fragments/postgres_db/)

### Blockchain programs

1. Solana: [`fragments/blockchain/solana`](./fragments/blockchain/solana/)

## Running the code

Each programming language supports local environment setup, or you can build and run with Docker instead.

Some core fragments expect services to be running on particular ports, such as Redis. Blockchain fragments also expect
some services to be running, such as node validators.

The easiest way to provision your local environment with the required services is through the provided Docker Compose
setup. You'll need [Docker](https://www.docker.com/get-started/) installed and running.

Spin up all the services before running any commands:

```
docker compose --profile blockchain up
```

If not working on blockchain fragments, you can omit the `blockchain` profile to save on CPU consumption:

```
docker compose up
```

### Node.js

All the Node.js code is written in TypeScript and uses [`tsx`](https://www.npmjs.com/package/tsx) to transpile and
execute the code.

#### Local (Node.js)

##### Setup

- Install [`nvm`](https://github.com/nvm-sh/nvm)
- `nvm install 22` if you don't already have this version
- `nvm use 22`
- Run `npm install` at root of repo
- Install [`dvm`](https://deno.land/x/dvm) for linting and formatting with deno
- `dvm install 2.1.6` if you don't already have this version
- `dvm use 2.1.6`

##### Run

> [!NOTE]
> TypeScript files in `./fragments/blockchain/solana/` will be in scope for some of these commands.

- Run all fragments:
  ```
  npm run fragments
  ```
- Run a single fragment, e.g.:
  ```
  npm run fragment -- fragments/env_vars/env_vars_utils.ts
  ```
- Run unit tests:
  ```
  npm run test
  ```
- Run the linter:
  ```
  npm run lint
  ```
- Run the TypeScript check:
  ```
  npm run tsc
  ```
- Run the formatter:
  ```
  npm run format:write
  ```
- Run the format check:
  ```
  npm run format:check
  ```

#### Docker (Node.js)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.node.Dockerfile -t ff_node .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_node
  ```
- Run a single fragment, e.g.:
  ```
  docker run --rm --network host ff_node fragments/env_vars/env_vars_utils.ts
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint npm ff_node run test
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint npm ff_node run lint
  ```
- Run the TypeScript check:
  ```
  docker run --rm --entrypoint npm ff_node run tsc
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint npm ff_node run format:check
  ```

### Python

#### Local (Python)

##### Setup

- Install [`pyenv`](https://github.com/pyenv/pyenv)
- `pyenv install 3.12.4` if you don't already have this version
- Ensure `python3 --version` prints the above version
- Create a
  [virtual environment](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/):
  ```
  python3 -m venv --clear .venv
  ```
- Activate the virtual environment: `source .venv/bin/activate`
- Ensure the Python interpreter being used is the virtual environment: `which python`
- Install dependencies: `pip install -r requirements.txt`
- Verify it's been installed with `pip list`
- You can run `deactivate` to exit the virtual environment at any time

##### Run

- Run all fragments:
  ```
  python -m fragments.main
  ```
- Run unit tests:
  ```
  python -m unittest -v
  ```
- Run the type check:
  ```
  mypy --config-file mypy.ini
  ```
- Run the linter:
  ```
  pylint ./fragments --rcfile ./pylintrc
  ```
- Run the formatter:
  ```
  black ./fragments
  ```
- Run the format check:
  ```
  black ./fragments --check
  ```

#### Docker (Python)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.python.Dockerfile -t ff_python .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_python
  ```
- Run unit tests:
  ```
  docker run --rm --network host ff_python -m unittest -v
  ```
- Run the type check:
  ```
  docker run --rm --entrypoint mypy ff_python --config-file mypy.ini
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint pylint ff_python ./fragments --rcfile ./pylintrc
  ```
- Run the formatter:
  ```
  docker run --rm --entrypoint black ff_python ./fragments
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint black ff_python ./fragments --check
  ```

### Rust

#### Local (Rust)

##### Setup

- Install [rustup](https://www.rust-lang.org/tools/install)

> [!NOTE]
> All `cargo` commands will use the Rust version and components as specified in
> [`./rust-toolchain.toml`](./rust-toolchain.toml)

##### Run

- Run all fragments:
  ```
  cargo run --bin fragments
  ```
- Run unit tests:
  ```
  cargo test
  ```
- Run the build:
  ```
  cargo build -v --release --bin fragments
  ```
- Run the linter:
  ```
  cargo clippy -- -D warnings
  ```
- Run the formatter:
  ```
  cargo fmt -v
  ```
- Run the format check:
  ```
  cargo fmt --check -v
  ```

#### Docker (Rust)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.rust.Dockerfile -t ff_rust .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_rust
  ```
- Run built binary:
  ```
  docker run --rm --network host --entrypoint target/release/fragments ff_rust
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint cargo ff_rust test
  ```
- Run the build:
  ```
  docker run --rm --entrypoint cargo ff_rust build -v --release --bin fragments
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint cargo ff_rust clippy -- -D warnings
  ```
- Run the formatter:
  ```
  docker run --rm --entrypoint cargo ff_rust fmt -v
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint cargo ff_rust fmt -v --check
  ```

### Go

#### Local (Go)

##### Setup

- Install [goenv](https://github.com/go-nv/goenv)
- `goenv install 1.23.1` if you don't already have this version installed
- `goenv version` to confirm the above version is being used
- Install [`golangci-lint`](https://golangci-lint.run/welcome/install/#local-installation) for linting
- Install dependencies: `cd ./fragments && goenv exec go mod tidy`

##### Run

- Run all fragments:
  ```
  goenv exec go run fragments/main.go
  ```
- Run unit tests:
  ```
  goenv exec go test ./fragments/...
  ```
- Run the build:
  ```
  goenv exec go build -v -o .bin/go_ff ./fragments/main.go
  ```
- Run the linter:
  ```
  golangci-lint run ./fragments/...
  ```
- Run the formatter:
  ```
  goenv exec gofmt -w ./fragments
  ```
- Run the format check:
  ```
  test -z $(goenv exec gofmt -l ./fragments)
  ```

#### Docker (Go)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.go.Dockerfile -t ff_go .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_go
  ```
- Run built binary:
  ```
  docker run --rm --network host --entrypoint .bin/ff_go ff_go
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint go ff_go test ./fragments/...
  ```
- Run the build:
  ```
  docker run --rm --entrypoint go ff_go build -v -o .bin/go_ff ./fragments/main.go
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint golangci-lint ff_go run -v ./fragments/...
  ```
- Run the formatter:
  ```
  docker run --rm --entrypoint gofmt ff_go -w ./fragments
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint test ff_go -z $(gofmt -l ./fragments)
  ```

### Solana

#### Local (Solana)

Solana programs are written in Rust, so make sure to follow the [Local (Rust)](#local-rust) setup instructions first.

##### Setup

- If not on macOS, check the [official docs](https://solana.com/docs/intro/installation) for any extra steps before
  continuing
- Install [Solana CLI](https://docs.anza.xyz/cli/install/) version `2.1.9`. For macOS:
  ```
  sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.9/install)"
  ```
- Ensure you follow the instructions to add the `solana` executable to your `PATH`
- Run `solana --version` to confirm the installation
- Install [`anchor`](https://www.anchor-lang.com/docs/installation):
  ```
  cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
  ```
- Run `anchor --version` to confirm the installation
- Generate your own key pair: `solana-keygen --config ./solana-cli.yml new -o ./solana.id.json`. This'll be used for
  local blockchain transactions
- Run `solana --config ./solana-cli.yml address` to confirm the key pair generation; it should output your public key
- Ensure the local Solana test validator is running (`docker compose --profile blockchain up`), then you can:
  - Airdrop some SOL to your address: `solana --config ./solana-cli.yml airdrop 5`
  - Run `solana --config ./solana-cli.yml balance` to confirm airdrop

##### Run

The following commands apply to the TypeScript file(s):

- Run the linter:
  ```
  npm run lint
  ```
- Run the TypeScript check:
  ```
  npm run tsc
  ```
- Run the formatter:
  ```
  npm run format:write
  ```
- Run the format check:
  ```
  npm run format:check
  ```

> [!IMPORTANT]
> Before running any of the commands in the next section, ensure you switch to this directory:
> `cd ./fragments/blockchain/solana/`
>
> Also, some commands require the Solana test validator to be running: `docker compose --profile blockchain up`, if not
> already.

- Deploy programs (all or individual):
  ```
  anchor deploy --provider.wallet ../../../solana.id.json
  anchor deploy --provider.wallet ../../../solana.id.json --program-name counter
  ```
- Build (all or individual):
  ```
  anchor build
  anchor build --program-name counter
  ```
- Run unit tests (uses [Bankrun](https://github.com/kevinheavey/solana-bankrun), not the local test validator):
  ```
  anchor test --skip-deploy --skip-local-validator
  ```
- Run the linter:
  ```
  cargo clippy -- -D warnings
  ```
- Run the formatter:
  ```
  cargo fmt -v
  ```
- Run the format check:
  ```
  cargo fmt --check -v
  ```

> [!TIP]
> Remember to sync keys after your first `anchor build`, so that the value of the program ID is correctly updated in all
> locations. Here's a thorough approach:
>
> 1. `anchor clean`
> 1. `rm -rf target/ .anchor/`
> 1. `anchor build`
> 1. `anchor keys sync`
> 1. `anchor build`

#### Docker (Solana)

- Build the Solana **builder** image at root of repo:
  ```
  docker build --force-rm -f docker.solana.Dockerfile --target builder -t ff_solana_builder .
  ```
- Build the Solana **final** image at root of repo:
  ```
  docker build --force-rm -f docker.solana.Dockerfile -t ff_solana .
  ```
- Generate a keypair:
  ```
  docker run --rm -v "$(pwd):/usr/ff" \
  --entrypoint solana-keygen ff_solana \
  --config ./solana-cli.yml \
  new -o ./solana.id.json --no-bip39-passphrase
  ```
  Confirm the key pair generation; it should output your public key:
  ```
  docker run --rm -v "$(pwd):/usr/ff" ff_solana --config ./solana-cli.yml address
  ```
- Run the solana test validator (if not running already with `docker compose --profile blockchain up`):
  ```
  docker run --rm --entrypoint solana-test-validator \
  -p 8899:8899 -p 1024:1024 -p 1027:1027 -p 8900:8900 ff_solana
  ```
- Airdrop some SOL to your address (required for `anchor deploy`):
  ```
  docker run --rm --network host -v "$(pwd):/usr/ff" ff_solana --config ./solana-cli.yml airdrop 5
  ```
  Confirm the airdrop:
  ```
  docker run --rm --network host -v "$(pwd):/usr/ff" ff_solana --config ./solana-cli.yml balance
  ```

#### Docker (Anchor)

> [!WARNING]
> Command `anchor test` doesn't currently work on macOS (arm64):
> `Error: Cannot find module 'solana-bankrun-linux-arm64-gnu'`. Perhaps there's not a Bankrun binary for linux+arm64 at
> the time of writing.

- Build the Anchor image at root of repo (depends on the `ff_solana_builder` image):
  ```
  docker build --force-rm -f docker.anchor.Dockerfile -t ff_anchor .
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint cargo ff_anchor clippy -- -D warnings
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint cargo ff_anchor fmt --check -v
  ```
- Build programs:
  ```
  docker run --rm --entrypoint bash ff_anchor \
  -c "anchor clean && rm -rf target/ .anchor/ && anchor build && anchor keys sync && anchor build"
  ```
- Deploy programs (solana test validator must be running, e.g. `docker compose --profile blockchain up`):
  ```
  docker run --rm --network host --entrypoint bash ff_anchor \
  -c "solana airdrop 5 && anchor deploy --provider.wallet /root/.config/solana/id.json"
  ```
- Unit tests:
  ```
  docker run --rm ff_anchor test --skip-build --skip-deploy --skip-local-validator
  ```
