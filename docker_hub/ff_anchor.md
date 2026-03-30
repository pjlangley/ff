# ff_anchor

This image is publicly accessible so that it can be used in the CI/CD pipeline for
[https://github.com/pjlangley/ff](https://github.com/pjlangley/ff). It's purpose is not for general public usage.

Details:

- Installs the [Anchor CLI](https://www.anchor-lang.com/docs/references/cli)
- Builds the Solana programs found in
  [https://github.com/pjlangley/ff](https://github.com/pjlangley/ff/tree/main/fragments/blockchain/solana)
- See this [Dockerfile](https://github.com/pjlangley/ff/blob/main/docker.anchor.ci.Dockerfile) for details of what's
  inside
- Currently, only the **amd64** OS/Arch is supported

## Usage

The default executable is `anchor`. So for example, you can rebuild the programs within the container like so:

```sh
docker run --rm pjlangley/ff_anchor:latest build
```
