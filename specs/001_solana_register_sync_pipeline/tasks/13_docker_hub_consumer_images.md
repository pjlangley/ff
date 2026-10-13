# 13 — Publish the consumer images to Docker Hub

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

~~`ff_node` and `ff_python` are~~ `ff_node` is built and pushed to Docker Hub by CI, so both the KIND and k3s clusters
can pull it. Today it is built only by `docker-compose.yaml` and never leaves the laptop — but the k3s EC2 instance
cannot reach a local Docker daemon.

> [!IMPORTANT]
> **Revised 2026-09-28 (during task 09):** the consumers are Node.js only, so `ff_python` is no longer published — it
> has no consumer to carry. See the requirements' [Revisions](../requirements.md#revisions). Struck-through text below
> is what the Python mirror would have needed.

## Depends on

- ~~12 (all four consumers exist and are worth shipping in an image)~~ 10 (both consumers exist and are worth shipping
  in an image)

## Changes

- `.github/workflows/docker.yml` — add ~~`ff_node` and `ff_python` jobs~~ an `ff_node` job mirroring the existing
  `ff_solana` / `ff_anchor` jobs (`paths-filter` on the Dockerfile plus `fragments/**`, buildx, login with
  `DOCKERHUB_TOKEN`), but published as **multi-arch manifest lists** covering `linux/amd64` and `linux/arm64`. Tag each
  image with the short SHA and `latest`, dropping the `-amd64-` infix the existing images use — the tag now resolves to
  a manifest list and the client picks its own platform. The existing images keep their single-arch tags; this
  deliberately deviates.
- Build each architecture on a **native runner** rather than emulating ~~a matrix over `ubuntu-latest` (amd64) and
  GitHub's hosted arm64 Linux runner (`ubuntu-24.04-arm` — free for public repositories; verify the current label),
  pushing by digest with `outputs: type=image,push-by-digest=true`. A dependent merge job then assembles the manifest
  list with `docker buildx imagetools create -t pjlangley/ff_node:<tag> <digest>...`. This is the documented
  `docker/build-push-action` multi-platform pattern.~~

  > [!NOTE]
  > **Revised 2026-10-13 (preflight):** Docker's
  > [multi-platform guide](https://docs.docker.com/build/ci/github-actions/multi-platform/) no longer documents the
  > hand-written push-by-digest + `imagetools create` recipe. It now points at the Docker-maintained
  > [`docker/github-builder`](https://github.com/docker/github-builder) reusable workflow, which does the same native
  > fan-out (`linux/arm64` → `ubuntu-24.04-arm` by default) and merges the manifest itself. The `ff_node` job calls
  > `docker/github-builder/.github/workflows/build.yml@v1` instead. It signs the attestation manifest with keyless
  > cosign when it pushes, so the job, and the `docker_images` job in `main.yml` that caps it, grant `id-token: write`.
  > That is the first explicit `permissions` block in the repo's workflows. Tags come from `docker/metadata-action`:
  > `type=sha,prefix=` (7-char short SHA) and `type=raw,value=latest`. Reasoning in ADR 014. The `ff_node` paths filter
  > also excludes `**/*.py` (paths-filter `predicate-quantifier: some-with-excludes`), so Python-only changes under
  > `fragments/` do not rebuild the image.

  The alternative — one job with `platforms: linux/amd64,linux/arm64` plus `docker/setup-qemu-action` — is far less
  workflow machinery, but builds arm64 under emulation. That matters here: `npm ci` pulls `better-sqlite3`, which falls
  back to compiling from source (node-gyp) if no `aarch64` prebuild is available ~~(as would `uv sync` for `solders`, in
  Rust)~~. Under QEMU that is slow at best and a timeout at worst. Try the native-runner path first; QEMU is the
  fallback if the arm64 runner is unavailable.
- `docker_hub/ff_node.md` ~~and `docker_hub/ff_python.md`~~ — Docker Hub description, mirroring the existing three.
- No Dockerfile changes are expected. `docker.node.Dockerfile` compiles the whole `fragments/` tree into
  `fragments/apis/fastify/dist/` (`tsconfig.api.json` sets `rootDir: ./fragments`), so the consumers are already in the
  image at `dist/solana_register_sync/*.js` — Kubernetes just overrides `command`/`args`. ~~Likewise
  `docker.python.Dockerfile`'s `ENTRYPOINT ["uv", "run", "--no-sync"]` takes
  `python -m fragments.solana_register_sync.registrants_consumer` as its `CMD`.~~ Confirm this holds before writing the
  manifests in task 14.
- New ADR via `/new-adr`: Docker Hub over ECR for container image distribution, **published multi-arch**. Context: the
  images are public OSS artifacts with no confidentiality requirement, the repo already publishes three images this way,
  and ECR's IAM-gated pull buys learning value rather than product value. Consequences to record:
  - Anonymous Docker Hub pulls are rate-limited per source IP, and the `ff_prod` EC2 gets a fresh public IP on every
    overnight restart. If a limit is ever hit, the escape hatch is an `imagePullSecret` with Docker Hub credentials for
    authenticated pulls.
  - `ff_node` ~~/ `ff_python`~~ is `amd64` + `arm64`; the older `ff_solana` / `ff_anchor` / `ff_solana_builder` images
    stay `amd64`-only. Record why the deviation is deliberate — the consumer images need to run on Graviton in the cloud
    and natively on an Apple Silicon laptop, whereas the Solana toolchain images were pinned to `amd64` for local macOS
    compatibility reasons that predate this work and have not been revisited.

**Architecture note:** the cloud target is Graviton (task 15 provisions an `arm64` instance), and the local Docker host
is Apple Silicon. Multi-arch therefore removes emulation from _both_ ends — today `ff_node` ~~and `ff_python`~~ runs
under Rosetta/QEMU on the laptop via `docker-compose`. A single-arch `amd64` image paired with a Graviton node would
fail to schedule outright, so the manifest list is load-bearing rather than cosmetic.

## Verification (QA)

- Locally: `docker compose build fastify fastapi`, then
  `docker run --rm --entrypoint node ff_node ./fragments/apis/fastify/dist/solana_register_sync/registrants_consumer.js`
  ~~starts, logs its config, and exits cleanly on `SIGTERM`~~ loads and exits `1` on its first missing environment
  variable. ~~The equivalent for `ff_python`.~~

  > [!NOTE]
  > **Revised 2026-10-13 (preflight):** `main()` needs eight environment variables, reads Secrets Manager and checks the
  > on-chain registry authority before it logs `started`, so a bare `docker run` cannot reach that point. The
  > missing-variable failure is what proves the compiled entrypoint and its runtime dependencies are in the image. The
  > start-up log and the clean `SIGTERM` exit are verified in task 14, where the cluster supplies config and AWS
  > credentials.
- `docker buildx imagetools inspect pjlangley/ff_node:<sha>` lists **both** `linux/amd64` and `linux/arm64` platforms.
  ~~The same for `ff_python`.~~
- On the Apple Silicon laptop, `docker pull pjlangley/ff_node:<sha>` resolves to the `arm64` variant:
  `docker image inspect --format '{{.Architecture}}'` reports `arm64`, and the container starts with no
  `platform mismatch` warning.
- `docker run --platform linux/amd64` still resolves and runs, confirming the manifest list serves both.
- `deno fmt` for the ADR, the Docker Hub docs and the README index.

## Definition of done

- CI builds and pushes `ff_node` ~~and `ff_python`~~ on changes to its Dockerfile, manifests (e.g. `package.json`) or
  `fragments/**`.
- ~~Both images are multi-arch manifest lists~~ The image is a multi-arch manifest list covering `linux/amd64` and
  `linux/arm64`, built on native runners rather than under emulation.
- The image can run either consumer entrypoint via a command override, verified locally.
- The `arm64` variant runs natively on the Apple Silicon laptop and is the variant a Graviton node would pull.
- The ADR is accepted and the README index updated.
