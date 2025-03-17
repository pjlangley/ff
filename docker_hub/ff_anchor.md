# ff_anchor

This image is publicly accessible so that it can be used in the CI/CD pipeline for
[https://github.com/pjlangley/ff](https://github.com/pjlangley/ff). It's purpose is not for general public usage.

Details:

- Installs the [Anchor CLI](https://www.anchor-lang.com/docs/references/cli) and program dependencies, such as Node.js
- Builds the Solana program(s) found in
  [https://github.com/pjlangley/ff](https://github.com/pjlangley/ff/tree/main/fragments/blockchain/solana)
- Runs the test suite against the compiled program(s)
- See this [Dockerfile](https://github.com/pjlangley/ff/blob/main/docker.anchor.ci.Dockerfile) for details of what's
  inside
- Currently, only the **amd64** OS/Arch is supported

## Usage

The default executable is `anchor`. So for example, you can rebuild the program(s) within the container like so:

```
docker run --rm pjlangley/ff_anchor:latest build
```
