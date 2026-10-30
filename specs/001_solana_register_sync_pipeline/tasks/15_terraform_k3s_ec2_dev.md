# 15 — k3s on EC2 in `ff_dev`

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A single small EC2 instance running k3s hosts the same ~~four consumers~~ two consumer Deployments (task 14) in
`ff_dev`, rehearsing the cloud deployment path before `ff_prod` ever sees it. ~~Its default state is **stopped**.~~ It
is the normal `ff_dev` consumer runtime, started and stopped on the poller's weekday window (revised 2026-10-15, see the
requirements' [Revisions](../requirements.md#revisions)).

## Depends on

- 14

## Changes

- `fragments/terraform/modules/k3s_node/` — new shared module (reused by `ff_prod` in task 17):
  - `aws_instance` on **Graviton / arm64** (`t4g.small`), pinned to an `arm64` Amazon Linux or Ubuntu AMI resolved via
    an `aws_ami` data source — never a hardcoded AMI id. `user_data` installs k3s via `get.k3s.io`, whose install script
    detects the architecture and fetches the `arm64` binary; k3s ships first-class `arm64` builds. This pairs with the
    multi-arch images from task 13.
  - **Secrets encryption at rest (added 2026-10-28):** `user_data` starts the k3s server with
    `--secrets-encryption --secrets-encryption-provider secretbox`. k3s generates and stores the key itself
    (`/var/lib/rancher/k3s/server/cred/encryption-config.json`). `secretbox` rather than the `aescbc` default, which the
    Kubernetes docs call "not recommended"; the provider flag needs an April 2025 or later k3s release (e.g.
    v1.32.4+k3s1). See [Secrets Encryption](https://docs.k3s.io/security/secrets-encryption). Not done on KIND: there
    the key would sit on the same laptop as two plaintext copies of the access key, for little gain.
  - Graviton instances are roughly 20% cheaper than their x86 equivalents at the same size, which suits the low-cost
    goal — and the arm64 path is where AWS is steering new workloads.
  - `aws_security_group`: egress open; ~~ingress restricted to an `admin_cidr` variable for the Kubernetes API (6443)
    and SSH. Consider AWS Systems Manager Session Manager instead of an SSH ingress rule.~~ **no ingress rules**
    (revised 2026-10-30, see the requirements' [Revisions](../requirements.md#revisions)). The Kubernetes API is not
    reached from the laptop; operator access is a shell on the node through AWS Systems Manager Session Manager, which
    needs no open port, key pair or `admin_cidr`.
  - `aws_iam_instance_profile` attaching the consumer policy module from task 06, so pods reach SQS, DynamoDB, Secrets
    Manager and EventBridge with **no static credentials** — the meaningful difference from the KIND overlay. It also
    attaches the AWS-managed `AmazonSSMManagedInstanceCore` policy so the SSM agent (preinstalled on Amazon Linux 2023
    and Ubuntu AMIs) can register the node for Session Manager.
  - `user_data` also installs `git`, which k3s's bundled `kubectl` needs to apply a Kustomize overlay from a GitHub URL
    on the node.
  - No Elastic IP: it carries a standing charge, and the public IP is expected to change across stop/start. Nothing
    depends on the public IP: it serves outbound traffic only, and operator access goes through Session Manager.
  - **The overnight pause (moved here from task 17, 2026-10-15):** two `aws_scheduler_schedule` resources using the
    templated `arn:aws:scheduler:::aws-sdk:ec2:startInstances` and `:stopInstances` targets (no Lambda), with
    `schedule_expression_timezone = "Europe/London"` and an IAM role permitting only those two actions on that one
    instance. Start 07:45 and stop 17:00, Monday to Friday, as module variables with those defaults: the poller fires
    hourly 08:00–16:00, and 17:00 leaves the consumers' 30-minute default poll interval time to drain the last batch.
- `fragments/terraform/ff_dev/` — instantiate the module; output the instance id ~~and public IP~~.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with EC2, security group and instance-profile actions,
  and the scheduler role the pause schedules pass.
- `README.md` — ~~the kubeconfig refresh after each start (fetch `/etc/rancher/k3s/k3s.yaml` and rewrite its server
  address to the new public IP; previously task 16's job)~~ opening a shell on the node
  (`aws ssm start-session --target <instance_id>`) and running `sudo kubectl …` there, where the local k3s kubeconfig
  works as-is; and the real instance-id output in place of the `<instance_id>` placeholder in task 14's KIND steps.
- `fragments/k8s/overlays/ff_dev/` — `kustomization.yaml` with its own `configMapGenerator`. No AWS credentials Secret
  and no `envFrom: secretRef` patch: the instance profile supplies them.
- New ADR via `/new-adr`: k3s on a single EC2 instance over EKS. Context: EKS bills roughly $0.10/hour for the control
  plane alone (~$73/month) before running a single pod, which is disproportionate for a portfolio workload; k3s is a
  CNCF-conformant distribution presenting the same API, `kubectl` and Kustomize surface from one binary in a few hundred
  megabytes of RAM. Consequences to record: no managed control-plane HA or upgrades, a single node is a single point of
  failure (acceptable — the cluster is stateless and SQS is durable), and k3s uses containerd rather than Docker, so
  images must arrive from a registry (see the Docker Hub ADR from task 13).
- New ADR via `/new-adr` (moved here from task 17, 2026-10-15): scheduled overnight pause of the poller and the EC2
  instances (`Europe/London`) as the cost-control approach, in both environments. Context and consequences as task 17
  set them out.
- New ADR via `/new-adr` (added 2026-10-30): Session Manager as the operator access path to the cloud cluster nodes,
  with no laptop `kubectl`. Context: the auto-assigned public IP changes on every scheduled start and the k3s API
  certificate does not cover it, so laptop `kubectl` would need a refresh after each start for a cluster that runs
  unattended. Consequences to record: no ingress rules at all (no 6443, no SSH, no `admin_cidr`) and no key pair; access
  is IAM-authorised and logged in CloudTrail; operator commands run on the node with `sudo kubectl`; overlays are
  applied from a pushed GitHub ref; laptop `kubectl` can be added later through a Session Manager port-forward.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`.
- `aws ec2 start-instances`, ~~fetch `/etc/rancher/k3s/k3s.yaml`, rewrite its server address to the public IP~~ open a
  Session Manager shell on the node, then `sudo kubectl get nodes` reports `Ready` and
  `sudo kubectl get node -o jsonpath='{..kubernetes\.io/arch}'` reports `arm64`.
- ~~**Pause the local KIND consumers first** (`kubectl scale deploy --replicas=0` against the KIND context) so the two
  runtimes don't compete for the `ff_dev` queues.~~ Make sure no KIND cluster is running (`kind get clusters`), so the
  two runtimes don't compete for the `ff_dev` queues.
- ~~`kubectl apply -k fragments/k8s/overlays/ff_dev`~~ On the node,
  `sudo kubectl apply -k 'https://github.com/pjlangley/ff//fragments/k8s/overlays/ff_dev?ref=<branch>'` (the overlay
  must be pushed first), ~~all four Deployments~~ both Deployments `Available` — confirming the pods pulled the `arm64`
  variant of the ~~manifest lists~~ `ff_node` manifest list from task 13 with no `exec format error` and no
  `ImagePullBackOff`.
- Register a test account and confirm the same end-to-end path as task 14 completes, this time on the cloud cluster,
  with the record reaching `audited`.
- ~~`aws ec2 stop-instances` returns the environment to its default posture.~~ The schedules stop the instance at 17:00
  and start it at 07:45 on a weekday (or invoke a schedule's target by hand), ~~and the started instance's new public IP
  is picked up by the kubeconfig refresh~~ and the consumers resume on the restarted node with no manual step.
- The README's KIND steps hand the `ff_dev` queues over: stopping the instance leaves the cloud cluster consuming
  nothing.
- `deno fmt` for the ADRs and the README index.

## Definition of done

- A k3s-on-EC2 cluster exists in `ff_dev` on a Graviton `arm64` instance, with an instance profile granting the consumer
  permissions.
- The same Kustomize base deploys to it via an `ff_dev` overlay, with no static AWS credentials in the cluster.
- The security group has no ingress rules; operator access is through Session Manager only.
- The full pipeline runs on the cloud cluster, reaching `audited`.
- ~~The instance is left **stopped** — it exists to rehearse the cloud path, not to run 24/7.~~ The instance starts and
  stops on its weekday schedule, `Europe/London`.
- ~~The ADR is~~ ~~Both ADRs are~~ All three ADRs are accepted and the README index updated.
