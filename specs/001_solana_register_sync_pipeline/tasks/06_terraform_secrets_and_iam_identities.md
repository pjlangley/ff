# 06 — Secrets Manager secrets and scoped IAM identities

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The devnet deployer keypair and the Helius RPC URL live in Secrets Manager per environment, and a scoped IAM user exists
so the local KIND cluster can reach the real `ff_dev` resources.

## Depends on

- 04, 05 (the consumer policy references the table, queues and bus)

## Changes

- `fragments/terraform/ff_dev/` and `ff_prod/`:
  - `aws_secretsmanager_secret` for the deployer keypair, and one for the Helius RPC URL (it embeds the API key, so it
    must not become a plaintext Lambda env var). Terraform manages the **secret container only** — the values are put
    out-of-band with `aws secretsmanager put-secret-value` so they never enter state. The exact commands are recorded as
    a comment beside the resources.
  - `recovery_window_in_days = 0` in `ff_dev` only — **decided during build**. The 30-day default holds the name after a
    destroy and blocks re-creating the same secret, which would stall the dev tear-down/stand-up loop. `ff_prod` keeps
    the default.
- `fragments/terraform/modules/solana_register_consumer_policy/` — new shared module emitting the consumer IAM policy
  document, reused by the local IAM user here and by the EC2 instance profile in task 15: `sqs:ReceiveMessage` /
  `DeleteMessage` / `GetQueueAttributes` on both queues, DynamoDB read+write on the table,
  `secretsmanager:GetSecretValue` on the two secrets, `events:PutEvents` on the bus. ~~All ARNs scoped to `{env}_*`~~ —
  **narrowed during build** to the exact ARNs the caller passes in (queues, table, secrets, bus). Tighter than the
  prefix, and every one of those ARNs is already a module output or resource attribute in the root. DynamoDB is
  `GetItem` / `PutItem` / `UpdateItem`: the table's hash key is the whole key so nothing queries or scans, and records
  are terminal at `audited` so nothing deletes. The module is declared in `ff_dev` only, and deliberately so: the IAM
  user exists purely for local KIND, which consumes `ff_dev` alone, so `ff_prod` has no consumer identity to attach it
  to yet. Each environment picks the module up again with its EC2 instance profile — `ff_dev` in task 15, `ff_prod` in
  task 17 — which is the only consumer identity `ff_prod` ever gets. Declaring it in `ff_prod` now would be dead
  configuration.
- `fragments/terraform/ff_dev/` only — `aws_iam_user` + `aws_iam_user_policy` for the local KIND runtime. `ff_prod` does
  not require local access.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with Secrets Manager and IAM user/policy management,
  scoped to `ff_dev_*`. Three details settled during build:
  - Neither `secretsmanager:PutSecretValue` nor `GetSecretValue` is granted — this identity creates the containers and
    nothing more. Seeding is a console/root operation (below) and reading is the consumer user's job, which this task's
    QA step depends on being a real separation.
  - No `iam:*AccessKey` actions at all. The key is created in the console (below), so the one principle holds
    throughout: this identity creates containers and identities, and handles no credential material. A consequence,
    documented in the README: `force_destroy` is left unset on the user, so the access key must be deleted by hand
    before a `terraform destroy`, which otherwise fails with a `DeleteConflict`. Setting `force_destroy = true` would
    trade that step for a much wider set of `iam:List*` / `iam:Delete*` grants.
- `fragments/terraform/ff_prod/tf_remote_iam_apply_policy.json` and `tf_remote_iam_plan_policy.json` — **added during
  build** (scope widened on the user's ruling), following the precedent set in tasks 04 and 05: Secrets Manager
  lifecycle actions scoped to `ff_prod_*` on the apply role (minus `PutSecretValue`, which Terraform never calls), and
  the read-only subset (`DescribeSecret`, `GetResourcePolicy`) on the plan role. No task in the spec extended the prod
  roles for Secrets Manager, so task 17's first prod apply would have failed on `secretsmanager:CreateSecret`. As
  before, the gap is invisible to this task's own verification — prod `plan` needs no API read for resources absent from
  state.

**Build-time call:** ~~`aws_iam_access_key` writes the secret access key into Terraform state. HCP state is encrypted
and `ff_dev` is local-execution, so this is defensible — but creating the access key by hand and keeping it out of state
entirely is the safer default.~~ **Decided during build** on the user's ruling: created **by hand, out of state**.
Terraform owns the user and its inline policy only; the key pair is created in the IAM console and mounted into KIND as
a k8s Secret. A long-lived credential in state is worth avoiding when the alternative is one manual step. The console
(rather than the CLI) keeps this consistent with the secret seeding above and lets the Terraform identity drop its
`iam:*AccessKey` grants entirely. Documented in the README under **Local cluster access key (manual)**.

**Seeding the values — settled during build.** Both environments' secret values are set by hand, as the root user, in
the Secrets Manager console, using the **Plaintext** tab so the deployer keypair stays a bare JSON array of bytes rather
than being wrapped in an object by `Key/value`. This follows the posture ADR 003 already records for the IAM policies
these workspaces depend on, and it resolves what would otherwise have been an open gap: `ff_prod` is addressable only by
the HCP runner's OIDC roles, so no CLI identity could have populated its secrets at all. No policy anywhere needs
`PutSecretValue` as a result.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod`.
- Using **only** the scoped IAM user's credentials: `aws sts get-caller-identity` resolves to that user, and
  `aws secretsmanager get-secret-value` returns the deployer keypair.
- The same credentials are **denied** against an `ff_prod_*` resource — confirming the `{env}_*` scoping holds.

**Run during build:** `terraform fmt -check -recursive` (passes) and a JSON parse of the three edited policy documents.
Everything else needs AWS or the Terraform registry, which the agent sandbox blocks — the provider plugin cannot be
launched to load its schema, so even `validate` fails offline. `validate`, `plan`, `apply`, the out-of-band
`put-secret-value` calls and the scoped-credential checks were left to the user.

## Definition of done

- Both secrets exist per environment with their values populated out-of-band, not in Terraform state.
- A reusable consumer policy module exists, attached to the `ff_dev` local IAM user.
- The local IAM user can read the secret, both queues, the table and the bus, and nothing in `ff_prod`.
- `terraform plan` succeeds for `ff_prod`.
