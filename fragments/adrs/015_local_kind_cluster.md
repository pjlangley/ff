# Local KIND cluster against real `ff_dev` cloud resources

**Status:** Accepted | **Date:** 2026-10-15

## Context and Problem Statement

The register sync pipeline (spec 001) runs its two Node.js consumers on Kubernetes: in `ff_dev` and `ff_prod`, each on a
k3s EC2 node that runs on a weekday schedule. Changes to the consumers need testing somewhere before they reach
`ff_dev`, so a local cluster runs them from an image built from the working tree. The consumers talk to SQS, DynamoDB,
EventBridge and Secrets Manager, and to the register program on devnet. The Lambda poller that feeds them stays in AWS
this iteration. The question is what the local cluster's consumers talk to: the real `ff_dev` resources, or a local
emulation of them.

## Considered Options

- KIND cluster wired to the real `ff_dev` AWS resources and the dev register instance on devnet
- KIND cluster wired to LocalStack (emulated SQS, DynamoDB, EventBridge and Secrets Manager), with the poller also run
  locally
- No local cluster: run the consumers only as plain Node.js processes, and use Kubernetes only on the k3s EC2 node

## Decision Outcome

Chosen option: "KIND cluster wired to the real `ff_dev` AWS resources", because fidelity to real SQS, DynamoDB,
EventBridge and Secrets Manager semantics is the point of the exercise. That covers visibility timeouts and redrive to
the DLQ, conditional writes, the EventBridge rule-to-queue path and IAM scoping, and every one of them is a behaviour an
emulator can quietly get wrong. The poller already runs in AWS on a schedule (spec 001, task 08), so a LocalStack setup
would also have to emulate the Lambda and EventBridge Scheduler to produce any messages at all.

KIND rather than plain processes, because the cluster is what the cloud nodes run: the same Kustomize base deploys
locally and to k3s, with only an overlay between them. Two replicas per Deployment exercise competing consumers on one
queue, and `SIGTERM` handling during a rollout is exercised exactly as in the cloud.

### Consequences

- Good, because local runs see real AWS behaviour, including IAM: a policy gap in the scoped runtime identity shows up
  locally rather than first on EC2
- Good, because the base manifests are shared with the cloud clusters, so the local loop also validates what is deployed
  there
- Good, because no emulator needs installing, versioning or keeping in step with the AWS APIs
- Bad, because the local cluster and the `ff_dev` k3s node consume the **same** queues. SQS consumers compete, so
  running both makes runs non-deterministic. The invariant is one consumer runtime attached to the `ff_dev` queue set at
  a time, kept by convention: the README's KIND steps stop the `ff_dev` EC2 instance first. Nothing enforces it, and a
  KIND cluster left running when the schedule next starts the instance breaks it - an accepted risk for a portfolio
  project
- Bad, because local runs need network access and AWS credentials, and incur (free-tier-sized) AWS usage. The kind
  overlay polls every 60s rather than back-to-back to keep request counts low
- Bad, because the local cluster needs a long-lived AWS credential, which the cloud clusters do not. That trade-off is
  recorded separately in [ADR 016](016_aws_identity_for_pods_runtime.md)
- Neutral, because the queue URLs carry the AWS account ID, which the repo never commits. The kind overlay reads them
  from a gitignored `queue_urls.env`, so a fresh checkout must copy the example file before the overlay renders

## More Information

- Manifests: [`fragments/k8s/base/`](../k8s/base/) and [`fragments/k8s/overlays/kind/`](../k8s/overlays/kind/); cluster
  config: [`fragments/k8s/kind-config.yaml`](../k8s/kind-config.yaml).
- README: _Local cluster (KIND)_ under _Solana register sync pipeline_.
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md), section F
  and task 14.
