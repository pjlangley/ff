# 15 — k3s on EC2 in `ff_dev`

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A single small EC2 instance running k3s hosts the same four consumers in `ff_dev`, rehearsing the cloud deployment path
before `ff_prod` ever sees it. Its default state is **stopped**.

## Depends on

- 14

## Changes

- `fragments/terraform/modules/k3s_node/` — new shared module (reused by `ff_prod` in task 17):
  - `aws_instance` on **Graviton / arm64** (`t4g.small`), pinned to an `arm64` Amazon Linux or Ubuntu AMI resolved via
    an `aws_ami` data source — never a hardcoded AMI id. `user_data` installs k3s via `get.k3s.io`, whose install script
    detects the architecture and fetches the `arm64` binary; k3s ships first-class `arm64` builds. This pairs with the
    multi-arch images from task 13.
  - Graviton instances are roughly 20% cheaper than their x86 equivalents at the same size, which suits the low-cost
    goal — and the arm64 path is where AWS is steering new workloads.
  - `aws_security_group`: egress open; ingress restricted to an `admin_cidr` variable for the Kubernetes API (6443) and
    SSH. Consider AWS Systems Manager Session Manager instead of an SSH ingress rule.
  - `aws_iam_instance_profile` attaching the consumer policy module from task 06, so pods reach SQS, DynamoDB, Secrets
    Manager and EventBridge with **no static credentials** — the meaningful difference from the KIND overlay.
  - No Elastic IP: it carries a standing charge, and the public IP is expected to change across stop/start.
- `fragments/terraform/ff_dev/` — instantiate the module; output the instance id and public IP.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with EC2, security group and instance-profile actions.
- `fragments/k8s/overlays/ff_dev/` — `kustomization.yaml` with its own `configMapGenerator`. No AWS credentials Secret
  and no `envFrom: secretRef` patch: the instance profile supplies them.
- New ADR via `/new-adr`: k3s on a single EC2 instance over EKS. Context: EKS bills roughly $0.10/hour for the control
  plane alone (~$73/month) before running a single pod, which is disproportionate for a portfolio workload; k3s is a
  CNCF-conformant distribution presenting the same API, `kubectl` and Kustomize surface from one binary in a few hundred
  megabytes of RAM. Consequences to record: no managed control-plane HA or upgrades, a single node is a single point of
  failure (acceptable — the cluster is stateless and SQS is durable), and k3s uses containerd rather than Docker, so
  images must arrive from a registry (see the Docker Hub ADR from task 13).

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`.
- `aws ec2 start-instances`, fetch `/etc/rancher/k3s/k3s.yaml`, rewrite its server address to the public IP, then
  `kubectl get nodes` reports `Ready` and `kubectl get node -o jsonpath='{..kubernetes\.io/arch}'` reports `arm64`.
- **Pause the local KIND consumers first** (`kubectl scale deploy --replicas=0` against the KIND context) so the two
  runtimes don't compete for the `ff_dev` queues.
- `kubectl apply -k fragments/k8s/overlays/ff_dev`, all four Deployments `Available` — confirming the pods pulled the
  `arm64` variant of the manifest lists from task 13 with no `exec format error` and no `ImagePullBackOff`.
- Register a test account and confirm the same end-to-end path as task 14 completes, this time on the cloud cluster,
  with the record reaching `audited`.
- `aws ec2 stop-instances` returns the environment to its default posture.
- `deno fmt` for the ADR and the README index.

## Definition of done

- A k3s-on-EC2 cluster exists in `ff_dev` on a Graviton `arm64` instance, with an instance profile granting the consumer
  permissions.
- The same Kustomize base deploys to it via an `ff_dev` overlay, with no static AWS credentials in the cluster.
- The full pipeline runs on the cloud cluster, reaching `audited`.
- The instance is left **stopped** — it exists to rehearse the cloud path, not to run 24/7.
- The ADR is accepted and the README index updated.
