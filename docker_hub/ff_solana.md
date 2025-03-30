# ff_solana

This image is publicly accessible so that it can be used in the CI/CD pipeline for
[https://github.com/pjlangley/ff](https://github.com/pjlangley/ff). It's purpose is not for general public usage.

Details:

- This extends from [ff_solana_builder](https://hub.docker.com/r/pjlangley/ff_solana_builder)
- It's designed to support the [Solana CLI](https://docs.anza.xyz/cli/)
- See this [Dockerfile](https://github.com/pjlangley/ff/blob/main/docker.solana.ci.Dockerfile) for details of what's
  inside
- Currently, only the **amd64** OS/Arch is supported

## Usage

The default executable is `solana`. For example, get the Solana CLI version with:

```sh
docker run --rm pjlangley/ff_solana:latest --version
```
