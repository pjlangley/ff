# 14 — Local KIND cluster and Kustomize base

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A local KIND cluster runs ~~all four consumers~~ both consumers, two replicas each, against the **real** `ff_dev` AWS
resources and the dev register instance on devnet, driven by a Kustomize base and a `kind` overlay. ~~This is the
primary daily-driver loop.~~ It is where local changes are tested before they reach `ff_dev` (revised 2026-10-15, see
_Settled during build_).

> [!IMPORTANT]
> **Revised 2026-09-28 (during task 09):** the consumers are Node.js only — two Deployments, not four, each at
> `replicas: 2` so competing consumers are still exercised. See the requirements'
> [Revisions](../requirements.md#revisions).

## Depends on

- 13

## Changes

All Kubernetes assets live under `fragments/k8s/`, mirroring `fragments/terraform/`.

- `fragments/k8s/base/` — one Deployment per consumer (~~`registrants_consumer_node`, `registrants_consumer_python`,
  `confirmed_consumer_node`, `confirmed_consumer_python`~~ `registrants-consumer`, `confirmed-consumer` — hyphens, since
  Kubernetes object names must be lowercase RFC 1123 and reject underscores), each at **`replicas: 2`** and overriding
  the image's command, plus a `kustomization.yaml`. Environment config arrives via `envFrom: configMapRef` so overlays
  never need a strategic-merge patch to change a single variable. `terminationGracePeriodSeconds` long enough for an
  in-flight message — `60`: task 09's worst case is ~25s (the 20s confirmation wait plus the AWS calls), which the 30s
  default leaves too little margin for. Set `imagePullPolicy: IfNotPresent` so a locally side-loaded image (see below)
  is trusted rather than re-pulled.
- `fragments/k8s/overlays/kind/` — `kustomization.yaml` with a `configMapGenerator` (~~queue URLs, table name, bus name,
  program id, region, secret ARN~~ the environment variables task 09 settled — `SOLANA_REGISTER_PROGRAM_ID`,
  `REGISTRANTS_QUEUE_URL`, `REGISTRATIONS_TABLE_NAME`, `EVENT_BUS_NAME`, `EVENT_SOURCE`, `DEPLOYER_KEYPAIR_SECRET_ID`,
  `HELIUS_RPC_URL_SECRET_ID`, `AWS_REGION`, and optionally `POLL_INTERVAL_SECONDS` (default 1800; lower it in the `kind`
  overlay for a tighter local loop) — plus whatever task 10 adds) and a patch adding `envFrom: secretRef` for the AWS
  credentials. The generator's content hash means a config change rolls the pods automatically.
- The AWS credentials Secret holds the scoped `ff_dev` IAM user's access keys from task 06. It must **not** be committed
  — create it with `kubectl create secret generic`, or generate it from a gitignored env file. Add the path to
  `.gitignore`.

  **This choice needs recording rather than assuming.** How a long-running workload authenticates to AWS is its own
  question, with its own constraints: no browser, no human at the terminal, and a process that must keep working for
  days without re-authenticating. That rules out every session-based flow, leaving a static key pair as the only
  practical option for a local cluster ~~short of IAM Roles Anywhere~~ (dropped from ADR 016's options, 2026-10-15). The
  cost is a long-lived credential living in etcd, which a KIND cluster stores base64-encoded rather than encrypted,
  since encryption at rest is off by default. The mitigations are that the key is scoped to one environment's pipeline
  ARNs (task 06), is never committed, and is revocable independently of every other identity. Note the contrast with
  task 15: the k3s EC2 needs no static credential at all, because an instance profile supplies short-lived ones — the
  local cluster is the only place this trade-off arises.
- `fragments/k8s/kind-config.yaml` ~~and a small script (`fragments/k8s/scripts/kind.sh up|down`) to create/delete the
  cluster and apply the overlay~~. The cluster is created, loaded and applied with plain README commands instead (see
  _Settled during build_).
- `README.md` — a section on the local KIND loop.
- New ADR via `/new-adr`: a local KIND cluster wired to real cloud resources rather than LocalStack. Context: fidelity
  against real SQS/DynamoDB/EventBridge/Secrets Manager semantics, at the cost of the single-consumer invariant that
  task 16 then enforces.
- Second ADR via `/new-adr`: **how the in-cluster consumer runtime authenticates to AWS** — static, scoped IAM access
  keys mounted as a k8s Secret in KIND, against an instance profile once the workload runs on EC2 (task 15). This is a
  standalone decision about workload identity, not a revision of anything: it neither supersedes nor amends
  [ADR 003](../../../fragments/adrs/003_aws_login_auth_for_ff_dev_workspace.md), which answers the separate question of
  how a human operator's laptop authenticates to run Terraform. Cite it for contrast only. Options to record as weighed
  and lost: mounting the host's `aws login` session (expires under a long-running pod)~~, and running the consumers
  outside k8s entirely (defeats the point of the task)~~ (dropped from ADR 016, 2026-10-15: ADR 015 already settles that
  the consumers run in a cluster, so it is not an option for this decision).

Only the consumers run here — the poller stays in AWS this iteration.

**Fast local-iteration escape hatch (for when a fragment itself needs changing).** The normal image source is Docker Hub
(task 13), but the k3s EC2 is the only reason for that — KIND can run a locally built image with no registry:
`docker build` the consumer image with a distinct dev tag (**not** `:latest`, which forces `imagePullPolicy: Always` and
defeats this), `kind load docker-image ff_node:kind`, then ~~`kubectl rollout restart deploy/...`~~ `kubectl apply -k`
the overlay, which points at `ff_node:kind` (see _Settled during build_), and `rollout restart` on later rebuilds. On
Apple Silicon the built image is `arm64` — the same variant the cloud Graviton node pulls — so the local and cloud
runtimes stay architecturally consistent. ~~Document this loop in the README alongside the Docker Hub path.~~ This is
now the only KIND path: the published image is exercised in `ff_dev`.

Settled during build:

- **Revised 2026-10-15, after the first build: KIND is a test bench, not the daily driver.** The `ff_dev` k3s EC2 (task
  15) becomes the normal `ff_dev` consumer runtime, running on the poller's weekday window and stopped overnight, as in
  `ff_prod`. KIND is for testing local changes before they reach `ff_dev`. The README's KIND steps stop the `ff_dev` EC2
  first, and starting it again afterwards is optional. Leaving KIND up when the schedule next starts the instance is an
  accepted risk. See the requirements' [Revisions](../requirements.md#revisions).
- **`kind.sh` dropped (revised 2026-10-15).** It was built, then replaced by plain README commands, which keep the
  `kind`, `kubectl` and `aws` invocations visible for learning. What the script added was small: idempotent re-runs, and
  creating the Secret through a process substitution so the key stayed out of `kubectl`'s argument list. The Secret is
  now generated (see the credentials bullet below), which keeps the key out of argument lists anyway.
- **Preflight (2026-10-15): a restart alone does not switch the pods to the local image.** The Deployments referenced
  the Docker Hub image, so after `kind load` the first switch would have needed `kubectl set image`. Moot once the
  overlay points straight at the local image (next bullet). Also, `:latest` only _defaults_ `imagePullPolicy` to
  `Always`; the explicit `IfNotPresent` set here would override it, but a distinct tag is still the clearer convention.
- **The queue URLs are not committed (ruled at preflight).** They embed the AWS account ID, which the repo has never
  committed. The overlay's `configMapGenerator` carries everything else as `literals` and merges the two queue URLs
  (`REGISTRANTS_QUEUE_URL`, `CONFIRMED_QUEUE_URL`) from a gitignored `overlays/kind/queue_urls.env`, copied from a
  committed `queue_urls.example.env` - the consumer env files' convention. `kubectl kustomize` therefore renders only
  after the copy exists. `.gitignore` covers `/fragments/k8s/overlays/*/*.env` minus `*.example.env`.
- ~~**The image is pinned to a short SHA (ruled at preflight).** The base references `pjlangley/ff_node`; the kind
  overlay pins `newTag: 6aa6837` (the newest multi-arch tag on Docker Hub at build time) via Kustomize `images:`.~~
  **Revised 2026-10-15: the kind overlay points at the locally built `ff_node:kind`** (`newName: ff_node`,
  `newTag: kind`), since KIND now tests local changes and the published image is exercised in `ff_dev`. The tag names
  the cluster it is for, so it can't be read as belonging to `ff_dev`. It exists on no registry; `kind load` puts it on
  the node and `IfNotPresent` trusts it there.
- **The credentials Secret is sourced from the AWS CLI profile (ruled at preflight).** ~~`kind.sh up`~~ A README step
  reads the key from the `ff_dev_solana_register_local_runtime` profile (`aws configure get`) into a gitignored
  `overlays/kind/aws_credentials.env`, written with `umask 077` by the `printf` builtin, which the overlay's
  `secretGenerator` turns into an immutable, hash-named `aws-credentials` Secret - the same pattern as `queue_urls.env`,
  with a committed `aws_credentials.example.env` documenting the format. The cost is a second plaintext copy of the key
  inside the repo tree, accepted because it reaches only the `ff_dev` pipeline; `kubectl kustomize` now prints the
  Secret, so the README warns before that step. ADR 016 records the trade-off.
- **The `envFrom: secretRef` patch is a JSON 6902 `add` to `envFrom/-`, targeting every Deployment.** `envFrom` has no
  strategic-merge key, so a strategic-merge patch would replace the list and drop the `configMapRef`.
- **The overlay repeats `namespace: solana-register-sync`.** The namespace transformer only reaches resources its own
  kustomization owns. Without it, the generated ConfigMap rendered into `default` and its hash-suffixed name was never
  wired into the `configMapRef`. Caught on the first render.
- **Also added:** a `solana-register-sync` Namespace in the base; `minReadySeconds: 15` (no readiness probe exists, so
  without it a pod that crashes during startup would briefly count as ready and `kubectl wait` could pass falsely);
  requests of `50m` / `128Mi` and a `256Mi` memory limit (unmeasured - revisit after the first runs);
  `POLL_INTERVAL_SECONDS=60` in the kind overlay; a `kind-config.yaml` naming the cluster `ff` (context `kind-ff`); and
  every README `kubectl` command names `--context kind-ff`, so none can reach the `ff_dev` cloud cluster by accident.
- **ADRs:** [015](../../../fragments/adrs/015_local_kind_cluster.md) (KIND against real cloud resources) and
  [016](../../../fragments/adrs/016_aws_identity_for_in_cluster_consumer_runtime.md) (in-cluster AWS identity).

## Verification (QA)

- `kubectl kustomize fragments/k8s/overlays/kind` renders valid manifests before anything is applied.
- `kubectl apply -k fragments/k8s/overlays/kind`, then ~~all four Deployments~~ both Deployments reach `Available` with
  two ready replicas each.
- Register a test account against the dev program. End to end, with no manual step: the poller emits a
  `RegistrationDetected` event → registrants SQS → a KIND consumer writes the DynamoDB record → `confirm_registration`
  lands on-chain with `confirmed_at` set → `RegistrationConfirmed` → confirmed SQS → the auditor verifies against the
  on-chain PDA and marks the record `audited`.
- Force a DynamoDB↔on-chain mismatch: the record is not audited, and the message reaches the confirmed DLQ.
- ~~`kubectl logs` shows both the Node.js and Python consumers picking up work~~ `kubectl logs` shows both replicas of a
  Deployment picking up work — competing consumers on one queue. Each registration is still confirmed once on-chain,
  with one row and its signature recorded.

## Definition of done

- The KIND loop runs ~~all four consumers~~ both consumers, two replicas each, against real `ff_dev` resources,
  credentials supplied as a k8s Secret and the deployer keypair sourced from Secrets Manager.
- The full happy path reaches `audited`; the mismatch path reaches the DLQ un-audited.
- No credentials are committed.
- **Both** ADRs are accepted and the README index updated — the KIND-against-real-cloud-resources one, and the one
  deciding how the in-cluster consumer runtime authenticates to AWS.
