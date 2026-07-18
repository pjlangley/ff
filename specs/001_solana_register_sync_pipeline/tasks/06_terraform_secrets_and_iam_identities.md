# 06 — Secrets Manager secrets and scoped IAM identities

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The devnet deployer keypair and the Helius RPC URL live in Secrets Manager per environment, and a scoped IAM user exists
so the local KIND cluster can reach the real `ff_dev` resources.

## Depends on

- 04, 05 (the consumer policy references the table, queues and bus)

## Changes

- `fragments/terraform/ff_dev/` and `ff_prod/`:
  - `aws_secretsmanager_secret` for the deployer keypair, and one for the Helius RPC URL (it embeds the API key, so it
    must not become a plaintext Lambda env var). Terraform manages the **secret container only** — the values are put
    out-of-band with `aws secretsmanager put-secret-value` so they never enter state.
- `fragments/terraform/modules/register_sync_consumer_policy/` — new shared module emitting the consumer IAM policy
  document, reused by the local IAM user here and by the EC2 instance profile in task 15: `sqs:ReceiveMessage` /
  `DeleteMessage` / `GetQueueAttributes` on both queues, DynamoDB read+write on the table,
  `secretsmanager:GetSecretValue` on the two secrets, `events:PutEvents` on the bus. All ARNs scoped to `{env}_*`.
- `fragments/terraform/ff_dev/` only — `aws_iam_user` + `aws_iam_user_policy` for the local KIND runtime. `ff_prod` does
  not require local access.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with Secrets Manager and IAM user/policy management,
  scoped to `ff_dev_*`.

**Build-time call:** `aws_iam_access_key` writes the secret access key into Terraform state. HCP state is encrypted and
`ff_dev` is local-execution, so this is defensible — but creating the access key by hand and keeping it out of state
entirely is the safer default. Decide and record the reasoning in the task's commit message.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod`.
- Using **only** the scoped IAM user's credentials: `aws sts get-caller-identity` resolves to that user, and
  `aws secretsmanager get-secret-value` returns the deployer keypair.
- The same credentials are **denied** against an `ff_prod_*` resource — confirming the `{env}_*` scoping holds.

## Definition of done

- Both secrets exist per environment with their values populated out-of-band, not in Terraform state.
- A reusable consumer policy module exists, attached to the `ff_dev` local IAM user.
- The local IAM user can read the secret, both queues, the table and the bus, and nothing in `ff_prod`.
- `terraform plan` succeeds for `ff_prod`.
