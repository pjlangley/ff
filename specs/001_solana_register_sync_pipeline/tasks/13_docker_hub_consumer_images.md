# 13 — Publish the consumer images to Docker Hub

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

`ff_node` and `ff_python` are built and pushed to Docker Hub by CI, so both the KIND and k3s clusters can pull them.
Today they are built only by `docker-compose.yaml` and never leave the laptop — but the k3s EC2 instance cannot reach a
local Docker daemon.

## Depends on

- 12 (all four consumers exist and are worth shipping in an image)

## Changes

- `.github/workflows/docker.yml` — add `ff_node` and `ff_python` jobs mirroring the existing `ff_solana` / `ff_anchor`
  jobs (`paths-filter` on the Dockerfile plus `fragments/**`, buildx, login with `DOCKERHUB_TOKEN`), but published as
  **multi-arch manifest lists** covering `linux/amd64` and `linux/arm64`. Tag each image with the short SHA and
  `latest`, dropping the `-amd64-` infix the existing images use — the tag now resolves to a manifest list and the
  client picks its own platform. The existing images keep their single-arch tags; this deliberately deviates.
- Build each architecture on a **native runner** rather than emulating: a matrix over `ubuntu-latest` (amd64) and
  GitHub's hosted arm64 Linux runner (`ubuntu-24.04-arm` — free for public repositories; verify the current label),
  pushing by digest with `outputs: type=image,push-by-digest=true`. A dependent merge job then assembles the manifest
  list with `docker buildx imagetools create -t pjlangley/ff_node:<tag> <digest>...`. This is the documented
  `docker/build-push-action` multi-platform pattern.

  The alternative — one job with `platforms: linux/amd64,linux/arm64` plus `docker/setup-qemu-action` — is far less
  workflow machinery, but builds arm64 under emulation. That matters here: `npm ci` pulls `better-sqlite3` and `uv sync`
  pulls `solders`, both of which fall back to compiling from source (node-gyp, Rust) if no `aarch64` wheel or prebuild
  is available. Under QEMU that is slow at best and a timeout at worst. Try the native-runner path first; QEMU is the
  fallback if the arm64 runner is unavailable.
- `docker_hub/ff_node.md` and `docker_hub/ff_python.md` — Docker Hub descriptions, mirroring the existing three.
- No Dockerfile changes are expected. `docker.node.Dockerfile` compiles the whole `fragments/` tree into
  `fragments/apis/fastify/dist/` (`tsconfig.api.json` sets `rootDir: ./fragments`), so the consumers are already in the
  image at `dist/solana_register_sync/*.js` — Kubernetes just overrides `command`/`args`. Likewise
  `docker.python.Dockerfile`'s `ENTRYPOINT ["uv", "run", "--no-sync"]` takes
  `python -m fragments.solana_register_sync.registrants_consumer` as its `CMD`. Confirm this holds before writing the
  manifests in task 14.
- New ADR via `/new-adr`: Docker Hub over ECR for container image distribution, **published multi-arch**. Context: the
  images are public OSS artifacts with no confidentiality requirement, the repo already publishes three images this way,
  and ECR's IAM-gated pull buys learning value rather than product value. Consequences to record:
  - Anonymous Docker Hub pulls are rate-limited per source IP, and the `ff_prod` EC2 gets a fresh public IP on every
    overnight restart. If a limit is ever hit, the escape hatch is an `imagePullSecret` with Docker Hub credentials for
    authenticated pulls.
  - `ff_node` / `ff_python` are `amd64` + `arm64`; the older `ff_solana` / `ff_anchor` / `ff_solana_builder` images stay
    `amd64`-only. Record why the deviation is deliberate — the consumer images need to run on Graviton in the cloud and
    natively on an Apple Silicon laptop, whereas the Solana toolchain images were pinned to `amd64` for local macOS
    compatibility reasons that predate this work and have not been revisited.

**Architecture note:** the cloud target is Graviton (task 15 provisions an `arm64` instance), and the local Docker host
is Apple Silicon. Multi-arch therefore removes emulation from _both_ ends — today `ff_node` and `ff_python` run under
Rosetta/QEMU on the laptop via `docker-compose`. A single-arch `amd64` image paired with a Graviton node would fail to
schedule outright, so the manifest list is load-bearing rather than cosmetic.

## Verification (QA)

- Locally: `docker compose build fastify fastapi`, then
  `docker run --rm --entrypoint node ff_node ./fragments/apis/fastify/dist/solana_register_sync/registrants_consumer.js`
  starts, logs its config, and exits cleanly on `SIGTERM`. The equivalent for `ff_python`.
- `docker buildx imagetools inspect pjlangley/ff_node:<sha>` lists **both** `linux/amd64` and `linux/arm64` platforms.
  The same for `ff_python`.
- On the Apple Silicon laptop, `docker pull pjlangley/ff_node:<sha>` resolves to the `arm64` variant:
  `docker image inspect --format '{{.Architecture}}'` reports `arm64`, and the container starts with no
  `platform mismatch` warning.
- `docker run --platform linux/amd64` still resolves and runs, confirming the manifest list serves both.
- `deno fmt` for the ADR, the Docker Hub docs and the README index.

## Definition of done

- CI builds and pushes `ff_node` and `ff_python` on changes to their Dockerfiles, manifests (e.g. `package.json`,
  `pyproject.toml`) or `fragments/**`.
- Both images are multi-arch manifest lists covering `linux/amd64` and `linux/arm64`, built on native runners rather
  than under emulation.
- Both images can run any of the four consumer entrypoints via a command override, verified locally.
- The `arm64` variant runs natively on the Apple Silicon laptop and is the variant a Graviton node would pull.
- The ADR is accepted and the README index updated.
