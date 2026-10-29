# AWS identity for the in-cluster consumer runtime: static scoped keys in KIND, instance profile on EC2

**Status:** Accepted | **Date:** 2026-10-15

## Context and Problem Statement

The register sync consumers (spec 001) run as long-lived pods: in the cloud on a k3s EC2 node, and locally on a KIND
cluster for testing changes before they reach `ff_dev` (see [ADR 015](015_local_kind_cluster.md)). They call SQS,
DynamoDB, EventBridge and Secrets Manager, so the pods need AWS credentials. How a long-running workload authenticates
has its own constraints: no browser, no human at the terminal, and a process that must keep working for days without
re-authenticating.

This is a question about workload identity. It is separate from how a human operator's laptop authenticates to run
Terraform, which [ADR 003](003_aws_login_auth_for_ff_dev_workspace.md) settles with `aws login`. That record is cited
here for contrast only; this one neither supersedes nor amends it.

## Considered Options

- KIND: a static access key for a scoped IAM user, mounted into the pods as a Kubernetes Secret. EC2: the instance
  profile
- KIND: mount the host's `aws login` session (the operator's own credentials) into the pods

## Decision Outcome

Chosen option: "static access key for a scoped IAM user in KIND, the instance profile on EC2", because it is the only
practical option that survives an unattended, long-running process on a laptop cluster. On EC2 the question does not
arise, because the instance profile hands out short-lived credentials through the instance metadata service, which the
AWS SDK's default chain picks up with no configuration. The local cluster is the only place a static credential is
needed.

The host's `aws login` session lost because it expires (hours at most), and a pod cannot complete a browser-based
refresh. It would also run the consumers as the operator, with far broader permissions than the pipeline needs.

The IAM user is `ff_dev_solana_register_local_runtime`. Terraform creates it and attaches the scoped consumer policy
document (the `solana_register_consumer_policy` module), limited to the `ff_dev` pipeline's ARNs. The EC2 instance
profile carries the same document (task 15). Its access key is created by hand, so the secret never enters Terraform
state, and is stored in an AWS CLI profile of the same name. A README step copies it from that profile into a gitignored
`aws_credentials.env` in the kind overlay, readable by its owner alone (`umask 077`) and written by a shell builtin, so
the key is never typed into an editor or passed as a command argument. The overlay's `secretGenerator` turns the file
into an immutable, hash-named `aws-credentials` Secret and adds it to each container's `envFrom`, and the SDK reads
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from the environment.

This follows the Kubernetes
[Secrets good practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/) that a local cluster can:
the Secret is never committed, lives in its own namespace, and reaches only the containers that need it. What it cannot
follow is the advice to prefer short-lived credentials, which the static key rules out; the cloud clusters do.

### Consequences

- Good, because the key is scoped to one environment's pipeline resources, so a leak exposes the `ff_dev` pipeline and
  nothing else
- Good, because it is revocable independently of every other identity, and rotating it touches nothing but the profile
  and the env file
- Good, because the Secret is generated with a content hash, like the ConfigMap, so applying the overlay after a
  rotation rolls the pods by itself
- Good, because the cloud clusters hold no static credential at all
- Bad, because it is a long-lived credential living in etcd, which KIND stores base64-encoded rather than encrypted:
  encryption at rest is off by default, and nothing here turns it on
- Bad, because the key has a second plaintext copy on disk, inside the repo's working tree, where editors, backups and
  coding agents can read it. Accepted because it reaches only the `ff_dev` pipeline; the file is gitignored, owner-only
  and kept out of coding agents' reads
- Bad, because `kubectl kustomize` prints the Secret, base64-encoded rather than encrypted, so the README warns before
  the render step
- Bad, because a rotation leaves the previous Secret in the cluster until it is deleted. It holds the old key, which is
  inert once deleted in IAM
- Bad, because the local and cloud pods authenticate differently, so the kind overlay carries a patch the cloud overlays
  will not

## More Information

- Generator and patch: [`fragments/k8s/overlays/kind/kustomization.yaml`](../k8s/overlays/kind/kustomization.yaml); env
  file format:
  [`fragments/k8s/overlays/kind/aws_credentials.example.env`](../k8s/overlays/kind/aws_credentials.example.env).
- IAM user and policy: [`fragments/terraform/ff_dev/solana_register.tf`](../terraform/ff_dev/solana_register.tf).
- README: _Local cluster access key (manual)_ and _Local cluster (KIND)_.
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md), task 14.
