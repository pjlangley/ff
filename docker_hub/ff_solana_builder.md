# ff_solana_builder

This image is publicly accessible so that it can be used in the CI/CD pipeline for
[https://github.com/pjlangley/ff](https://github.com/pjlangley/ff). It's purpose is not for general public usage.

Details:

- This is a _builder_ stage image for other Solana-based images at
  [https://hub.docker.com/u/pjlangley](https://hub.docker.com/u/pjlangley)
- It's designed to support the [Solana CLI](https://docs.anza.xyz/cli/) and the
  [Anchor CLI](https://www.anchor-lang.com/docs/references/cli) by installing the necessary dependencies and build tools
  to extend from
- See this [Dockerfile](https://github.com/pjlangley/ff/blob/main/docker.solana.ci.Dockerfile) for details of what's
  inside
- Currently, only the **amd64** OS/Arch is supported

## Usage

Extend from this image in your Dockerfile:

```dockerfile
FROM pjlangley/ff_solana_builder:latest
# ...
```
