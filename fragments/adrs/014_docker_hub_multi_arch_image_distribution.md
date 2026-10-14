# Docker Hub over ECR for container image distribution, published multi-arch

**Status:** Accepted | **Date:** 2026-10-13

## Context and Problem Statement

The register sync pipeline (spec 001) runs its two Node.js consumers on Kubernetes: a local KIND cluster and a k3s node
on EC2. Both clusters pull `ff_node`, the image `docker.node.Dockerfile` builds. Until now that image was built only by
`docker-compose.yaml` and never left the laptop, and the EC2 node cannot reach a local Docker daemon. This record
settles two things: which registry the image is published to, and which architectures it covers.

The cloud node is Graviton (`arm64`, k3s on a `t4g.small`) and the local Docker host is Apple Silicon (`arm64`). The CI
runners are `amd64`. The repo already publishes three images to Docker Hub from `.github/workflows/docker.yml`
(`ff_solana_builder`, `ff_solana`, `ff_anchor`), all `amd64`-only.

## Considered Options

- Amazon ECR, private repository, pulled with IAM credentials from each cluster
- Docker Hub, public repository, `amd64`-only like the existing images
- Docker Hub, public repository, multi-arch manifest list (`amd64` + `arm64`)

## Decision Outcome

Chosen option: "Docker Hub, public repository, multi-arch manifest list", because the image is a public OSS artifact
with no confidentiality requirement, the repo already publishes this way, and the manifest list is what lets one tag run
natively on both the Graviton node and the Apple Silicon laptop.

**Registry.** ECR's IAM-gated pull buys learning value rather than product value here: the image contains only code that
is already public on GitHub, and nothing secret is baked in (keys and RPC URLs come from Secrets Manager at runtime).
Using ECR would mean an `imagePullSecret` refresher in KIND and an ECR pull grant on the EC2 instance profile, solving a
problem this image does not have.

**Architectures.** A single-arch `amd64` image paired with a Graviton node would not schedule at all, so the manifest
list is load-bearing rather than cosmetic. Tags are the short commit SHA and `latest`, without the `-amd64-` infix the
existing images carry: each tag now resolves to a manifest list, and the client picks its own platform.

**Build.** Each architecture builds on its own native GitHub-hosted runner (`ubuntu-24.04` and `ubuntu-24.04-arm`).
Emulation was rejected because `npm ci` pulls `better-sqlite3`, which falls back to compiling from source with node-gyp
when no prebuild matches. Under QEMU that is slow at best and a timeout at worst. The task was originally planned as a
hand-written matrix that pushes by digest and merges with `imagetools create`. During the build, Docker's multi-platform
guide turned out to no longer document that recipe; it now points at `docker/github-builder`, which does the same native
fan-out and manifest merge itself. That reusable workflow was chosen over hand-rolling a recipe Docker no longer
maintains.

### Consequences

- Good, because one tag runs natively on Graviton, on Apple Silicon and on `amd64` CI runners, so the local KIND cluster
  and the k3s node pull the same image without emulation (`docker-compose` is unaffected: it still builds `ff_node`
  locally with `pull_policy: never`)
- Good, because no cluster needs registry credentials: KIND and k3s pull anonymously
- Good, because the native-runner fan-out and the manifest merge are Docker-maintained, so `docker.yml` declares only
  the Dockerfile, the platforms and the tags
- Good, because `docker/github-builder` signs the build's attestation manifest with keyless cosign when it pushes,
  adding supply-chain provenance the other images do not have
- Neutral, because the signing needs `id-token: write`, which `main.yml` grants to the `docker_images` job. It is the
  first explicit `permissions` block in the repo's workflows, and it scopes that job's `GITHUB_TOKEN` down to
  `contents: read` as well
- Neutral, because the image index also carries attestation manifests (listed as `unknown/unknown` by
  `docker buildx imagetools inspect`) alongside the two platform images
- Bad, because `ff_node` deliberately deviates from the older `ff_solana` / `ff_anchor` / `ff_solana_builder` images,
  which stay `amd64`-only with `-amd64-` tags. Those were pinned to `amd64` for local macOS compatibility reasons that
  predate this work and have not been revisited
- Bad, because the build is a nested reusable workflow (`main.yml` → `docker.yml` → `docker/github-builder`), so its
  steps are less visible than an inline `build-push-action` job, and its behaviour moves with the `@v1` tag
- Bad, because anonymous Docker Hub pulls are rate-limited per source IP, and the `ff_prod` EC2 instance gets a fresh
  public IP on every overnight restart. If a limit is ever hit, the escape hatch is an `imagePullSecret` with Docker Hub
  credentials for authenticated pulls

## More Information

- Workflow: [`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) (`ff_node` and `ff_node_docs` jobs),
  called from [`main.yml`](../../.github/workflows/main.yml).
- Docker Hub description: [`docker_hub/ff_node.md`](../../docker_hub/ff_node.md).
- Docker's guide to
  [multi-platform images with GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/).
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md), task 13.
