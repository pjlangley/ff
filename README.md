# Fullstack fragments

A collection of single responsibility code samples in a variety of programming languages for comparison, with an
emphasis on functional programming. What I call _fullstack fragments_.

The supported programming languages are:

- ✅ Node.js
- ✅ Python
- ✅ Rust
- ✅ Go

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

## Running the code

Each programming language supports local environment setup, or you can build and run with Docker instead.

Some fragments expect services to be running on particular ports, such as Redis. The easiest way to provision your local
environment with the required services is through the provided Docker Compose setup. You'll need
[Docker](https://www.docker.com/get-started/) installed and running.

Spin up the services before running any commands:

```
docker-compose up
```

<details>
<summary>Node.js</summary>
<br/>

All the node.js code is written in TypeScript. I'm using [`tsx`](https://www.npmjs.com/package/tsx) to transpile and
execute the code.

### Local (Node.js)

#### Setup

- Install [`nvm`](https://github.com/nvm-sh/nvm)
- `nvm install 22` if you don't already have this version
- `nvm use 22`
- Run `npm install` at root of repo

#### Run

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

### Docker (Node.js)

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

</details>

---

<details>
<summary>Python</summary>
<br/>

### Local (Python)

#### Setup

- Install [`pyenv`](https://github.com/pyenv/pyenv)
- `pyenv install 3.12.4` if you don't already have this version
- Ensure `python3 --version` prints the above version
- Create a
  [virtual environment](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/):
  ```
  python3 -m venv .venv
  ```
- Activate the virtual environment: `source .venv/bin/activate`
- Ensure the Python interpreter being used is the virtual environment: `which python3`
- Create a `.pth` file in the virtual environment to set the repo in the Python path:
  ```
  touch .venv/lib/python3.12/site-packages/ff.pth
  pwd > .venv/lib/python3.12/site-packages/ff.pth
  ```
- Install dependencies: `python3 -m pip install -r requirements.txt`
- Verify it's been installed with `python3 -m pip list`
- You can run `deactivate` to exit the virtual environment at any time

#### Run

- Run all fragments:
  ```
  python3 ./fragments/main.py
  ```
- Run a single fragment, e.g.:
  ```
  python3 ./fragments/env_vars/env_vars_utils.py
  ```
- Run unit tests:
  ```
  python3 -m unittest -v
  ```
- Run the type check:
  ```
  python3 -m mypy --config-file mypy.ini
  ```
- Run the linter:
  ```
  python3 -m pylint ./fragments --rcfile ./pylintrc
  ```
- Run the formatter:
  ```
  python3 -m black ./fragments --line-length 120
  ```
- Run the format check:
  ```
  python3 -m black ./fragments --check --line-length 120
  ```

### Docker (Python)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.python.Dockerfile -t ff_python .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_python
  ```
- Run a single fragment, e.g.:
  ```
  docker run --rm --network host --entrypoint python3 ff_python ./fragments/env_vars/env_vars_utils.py
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint python3 ff_python -m unittest -v
  ```
- Run the type check:
  ```
  docker run --rm --entrypoint python3 ff_python -m mypy --config-file mypy.ini
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint python3 ff_python -m pylint ./fragments --rcfile ./pylintrc
  ```
- Run the formatter:
  ```
  docker run --rm --entrypoint python3 ff_python -m black ./fragments --line-length 120
  ```
- Run the format check:
  ```
  docker run --rm --entrypoint python3 ff_python -m black ./fragments --check --line-length 120
  ```

</details>

---

<details>
<summary>Rust</summary>
<br/>

### Local (Rust)

#### Setup

- Install [Rust](https://www.rust-lang.org/tools/install)
- `rustup toolchain install 1.79.0` if you don't already have this version installed
- `rustc --version` to confirm the above version is being used
- Add `clippy` for enhanced linting: `rustup component add clippy`
- Add `rustfmt` for formatting: `rustup component add rustfmt`

#### Run

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
  cargo build --release --bin fragments
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

### Docker (Rust)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.rust.Dockerfile -t ff_rust .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_rust
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint cargo ff_rust test
  ```
- Run the build:
  ```
  docker run --rm --entrypoint cargo ff_rust build --release --bin fragments
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

</details>

---

<details>
<summary>Go</summary>
<br/>

### Local (Go)

#### Setup

- Install [goenv](https://github.com/go-nv/goenv)
- `goenv install 1.23.1` if you don't already have this version installed
- `goenv version` to confirm the above version is being used
- Install [`golangci-lint`](https://golangci-lint.run/welcome/install/#local-installation) for linting
- Install dependencies: `cd ./fragments && goenv exec go mod tidy`

#### Run

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
  goenv exec go build -o .bin/go_ff ./fragments/main.go
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

### Docker (Go)

- Build the image at root of repo:
  ```
  docker build --force-rm -f docker.go.Dockerfile -t ff_go .
  ```
- Run all fragments:
  ```
  docker run --rm --network host ff_go
  ```
- Run unit tests:
  ```
  docker run --rm --network host --entrypoint go ff_go test ./fragments/...
  ```
- Run the build:
  ```
  docker run --rm --entrypoint go ff_go build -o .bin/go_ff ./fragments/main.go
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

</details>
