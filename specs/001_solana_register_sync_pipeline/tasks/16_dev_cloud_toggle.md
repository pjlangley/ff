# 16 — `dev-cloud` toggle script

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

One command hands the `ff_dev` queue set cleanly between the local KIND cluster and the `ff_dev` k3s cluster, enforcing
the invariant that **exactly one consumer runtime is attached at a time**.

## Depends on

- 15

## Changes

- `fragments/k8s/scripts/dev_cloud.sh` with subcommands:
  - `up` — `aws ec2 start-instances`, wait for the instance to pass its status checks, refresh the kubeconfig server
    address with the new public IP (it changes on every start; there is no Elastic IP), and scale the cloud Deployments
    to 1. Scaling the KIND Deployments to 0 first.
  - `down` — scale the cloud Deployments to 0, `aws ec2 stop-instances`, then restore the KIND Deployments to 1. This is
    the default posture.
  - `pause` / `resume` — the in-session toggle for when the EC2 is already running:
    `kubectl scale deploy … --replicas=0` and back to `1` against a chosen context. No app code, no queue
    reconfiguration — SQS consumers are pull-based, so the consumer is the only thing to switch.
  - `status` — report the instance state and the replica counts in both contexts, so the invariant is inspectable.
- `README.md` — document the toggle and the single-runtime invariant.

The script must refuse to leave both runtimes scaled up. Guard `up` and `resume` on the other context being at zero.

## Verification (QA)

- `./fragments/k8s/scripts/dev_cloud.sh status` on a fresh checkout reports the EC2 stopped and KIND serving.
- `up` then `status`: the cloud cluster serves, KIND is at zero replicas, and the refreshed kubeconfig reaches the new
  public IP.
- Register a test account while the cloud cluster is serving: it processes to `audited` exactly once. Inspect the
  DynamoDB record for a single row and a single audit timestamp.
- `down` then `status`: KIND serves again, the EC2 is stopped.
- Register a test account while both would otherwise be up, having forced the guard off: confirm the guard is what
  prevents double-processing, not luck.

## Definition of done

- A single command switches the `ff_dev` queues between local KIND and the cloud cluster with no double-processing.
- The stop/start path refreshes the kubeconfig endpoint automatically.
- The script refuses to attach two consumer runtimes to the same queue set.
- The default posture — EC2 stopped, KIND as the daily driver — is restored by `down`.
