# Fullstack fragments

A collection of single responsibility code samples in a variety of programming languages for comparison. What I call
_fullstack fragments_.

## Code contents

1. Working with environment variables: [`fragments/env_vars`](./fragments/env_vars/)

## Running the code

Each programming language supports local environment setup, or you can build and run with Docker instead. If you're
using [Docker](https://www.docker.com/get-started/) I'll assume you've already installed it and it's running

<details>
<summary>Node.js</summary>

All the node.js code is written in TypeScript. I'm using [`tsx`](https://www.npmjs.com/package/tsx) to transpile and
execute the code.

### Local

- Install [node.js v20](https://nodejs.org/en/download/package-manager)
- Run `npm install` at root of repo
- Run all fragments:
  ```
  npm run fragments
  ```
- Run a single fragment, e.g.:
  ```
  npm run fragment -- fragments/env_vars/env_vars.node.ts
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

### Docker

- Build the image at root of repo:
  ```
  docker build --force-rm -f Dockerfile.node -t fullstack_fragments_node .
  ```
- Run all fragments:
  ```
  docker run --rm fullstack_fragments_node
  ```
- Run a single fragment, e.g.:
  ```
  docker run --rm fullstack_fragments_node fragments/env_vars/env_vars.node.ts
  ```
- Run unit tests:
  ```
  docker run --rm --entrypoint npm fullstack_fragments_node run test
  ```
- Run the linter:
  ```
  docker run --rm --entrypoint npm fullstack_fragments_node run lint
  ```
- Run the TypeScript check:
  ```
  docker run --rm --entrypoint npm fullstack_fragments_node run tsc
  ```
  </details>
