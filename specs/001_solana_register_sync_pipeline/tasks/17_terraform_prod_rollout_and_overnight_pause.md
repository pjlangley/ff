# 17 — `ff_prod` rollout and overnight pause

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The whole pipeline runs in `ff_prod` against the prod register instance, and an overnight schedule stops the EC2 and
windows the poller on `Europe/London` time so producer and consumers wake together.

## Depends on

- 16 (the cloud path is rehearsed in `ff_dev` before prod sees it)

## Changes

- `fragments/terraform/ff_prod/` — instantiate the `k3s_node` module (task 15) and confirm the DynamoDB table, bus,
  rules, secrets, Lambda and scheduler from tasks 04–08 are all present and pointed at the **prod** program id.
- `fragments/terraform/ff_prod/` — the overnight pause: two `aws_scheduler_schedule` resources using the templated
  `arn:aws:scheduler:::aws-sdk:ec2:stopInstances` and `:startInstances` targets (no Lambda), with
  `schedule_expression_timezone = "Europe/London"` and an IAM role permitting only those two actions on that one
  instance. Align the start/stop times with the poller's daytime window from task 08.
- `fragments/k8s/overlays/ff_prod/` — `kustomization.yaml` with its own `configMapGenerator` (prod queues, table, bus,
  prod program id). Instance profile for credentials, as in `ff_dev`.
- The start path must refresh the kubeconfig endpoint — the auto-assigned public IP changes on every restart. Reuse the
  helper from task 16.
- Populate the prod Secrets Manager values out-of-band (deployer keypair, Helius URL).
- New ADR via `/new-adr`: scheduled overnight pause of the poller and the EC2 instances (`Europe/London`) as the
  cost-control approach. Context: the cluster is stateless and SQS is durable with 14-day retention (task 04), so an
  overnight gap loses nothing — a registration made during the down window is simply ingested in the next active window,
  which the state-reconciliation design tolerates. Consequence: confirmation latency for overnight registrants is
  bounded by the window, not by the poll interval.
- `README.md` — document the prod pipeline and the pause schedule.

## Verification (QA)

- Terraform format check and `validate`. `terraform plan` and `apply` for `ff_prod` run through HCP remote execution via
  the `terraform_deploy.yml` workflow and its `ff_prod` approval gate.
- With the prod cluster up, register a test account against the **prod** program: it reaches `audited`, and the `ff_dev`
  records are untouched — confirming the two on-chain instances and the two AWS environments are fully isolated.
- **Pause test:** let the overnight stop fire (or invoke the schedule's target manually). Register a test account during
  the down window. On resume, confirm with no manual intervention that the poller ingests it, the consumers process it,
  and the record reaches `audited`.
- Confirm the EC2 stops and starts on schedule, and that the started instance's new public IP is picked up.
- `deno fmt` for the ADR and the README index.

## Definition of done

- `terraform plan`/`apply` succeeds for both `ff_dev` and `ff_prod` with all new resources.
- The prod pipeline processes a prod-instance registration end to end to `audited`, isolated from dev.
- The overnight schedule stops the EC2 and windows the poller on `Europe/London` time.
- A registration made during the down window is picked up and processed on resume, with no loss and no manual
  intervention.
- All repo checks pass: `deno fmt` / `cargo fmt` / `terraform fmt`, and the lint, typecheck and test suites for every
  language touched.
- The ADR is accepted and the README index updated.
