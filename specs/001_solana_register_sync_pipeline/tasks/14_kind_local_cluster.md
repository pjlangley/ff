# 14 — Local KIND cluster and Kustomize base

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A local KIND cluster runs all four consumers against the **real** `ff_dev` AWS resources and the dev register instance
on devnet, driven by a Kustomize base and a `kind` overlay. This is the primary daily-driver loop.

## Depends on

- 13

## Changes

All Kubernetes assets live under `fragments/k8s/`, mirroring `fragments/terraform/`.

- `fragments/k8s/base/` — one Deployment per consumer (`registrants_consumer_node`, `registrants_consumer_python`,
  `confirmed_consumer_node`, `confirmed_consumer_python`), each overriding the image's command, plus a
  `kustomization.yaml`. Environment config arrives via `envFrom: configMapRef` so overlays never need a strategic-merge
  patch to change a single variable. `terminationGracePeriodSeconds` long enough for an in-flight message. Set
  `imagePullPolicy: IfNotPresent` so a locally side-loaded image (see below) is trusted rather than re-pulled.
- `fragments/k8s/overlays/kind/` — `kustomization.yaml` with a `configMapGenerator` (queue URLs, table name, bus name,
  program id, region, secret ARN) and a patch adding `envFrom: secretRef` for the AWS credentials. The generator's
  content hash means a config change rolls the pods automatically.
- The AWS credentials Secret holds the scoped `ff_dev` IAM user's access keys from task 06. It must **not** be committed
  — create it with `kubectl create secret generic`, or generate it from a gitignored env file. Add the path to
  `.gitignore`.
- `fragments/k8s/kind-config.yaml` and a small script (`fragments/k8s/scripts/kind.sh up|down`) to create/delete the
  cluster and apply the overlay.
- `README.md` — a section on the local KIND loop.
- New ADR via `/new-adr`: a local KIND cluster wired to real cloud resources rather than LocalStack. Context: fidelity
  against real SQS/DynamoDB/EventBridge/Secrets Manager semantics, at the cost of the single-consumer invariant that
  task 16 then enforces.

Only the consumers run here — the poller stays in AWS this iteration.

**Fast local-iteration escape hatch (for when a fragment itself needs changing).** The normal image source is Docker Hub
(task 13), but the k3s EC2 is the only reason for that — KIND can run a locally built image with no registry:
`docker build` the consumer image with a distinct dev tag (**not** `:latest`, which forces `imagePullPolicy: Always` and
defeats this), `kind load docker-image ff_node:dev`, then `kubectl rollout restart deploy/...`. On Apple Silicon the
built image is `arm64` — the same variant the cloud Graviton node pulls — so the local and cloud runtimes stay
architecturally consistent. Document this loop in the README alongside the Docker Hub path.

## Verification (QA)

- `kubectl kustomize fragments/k8s/overlays/kind` renders valid manifests before anything is applied.
- `kubectl apply -k fragments/k8s/overlays/kind`, then all four Deployments reach `Available`.
- Register a test account against the dev program. End to end, with no manual step: the poller emits a
  `RegistrationDetected` event → registrants SQS → a KIND consumer writes the DynamoDB record → `confirm_registration`
  lands on-chain with `confirmed_at` set → `RegistrationConfirmed` → confirmed SQS → the auditor verifies against the
  on-chain PDA and marks the record `audited`.
- Force a DynamoDB↔on-chain mismatch: the record is not audited, and the message reaches the confirmed DLQ.
- `kubectl logs` shows both the Node.js and Python consumers picking up work — competing consumers on one queue.

## Definition of done

- The KIND loop runs all four consumers against real `ff_dev` resources, credentials supplied as a k8s Secret and the
  deployer keypair sourced from Secrets Manager.
- The full happy path reaches `audited`; the mismatch path reaches the DLQ un-audited.
- No credentials are committed.
- The ADR is accepted and the README index updated.
