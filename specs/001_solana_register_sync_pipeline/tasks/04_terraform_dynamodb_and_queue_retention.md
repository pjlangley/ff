# 04 — DynamoDB registrations table and 14-day queue retention

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

Each environment has an on-demand DynamoDB table holding registration records and the poller's watermark, and both SQS
queues retain messages for the 14-day maximum so a long pause can't strand a record.

## Depends on

- none (independent of the on-chain tasks)

## Changes

- `fragments/terraform/modules/sqs_queue_with_dlq/` — add a `message_retention_seconds` variable (default `1209600`)
  applied to both the source queue and its DLQ.
- `fragments/terraform/modules/registrations_table/` — new shared module wrapping `aws_dynamodb_table`:
  `PAY_PER_REQUEST` billing, single string hash key `pk`. Everything else is schemaless. Two item shapes share the
  table:
  - `REGISTRANT#<pubkey>` — `registration_index`, `registered_at`, `confirmed_at`, `status`
    (`registered`→`confirmed`→`audited`), source signatures, timestamps.
  - `WATERMARK#<program_id>` — the last-processed `registration_count`.
- `fragments/terraform/ff_dev/solana_register.tf` and `ff_prod/solana_register.tf` — instantiate the table (named from
  `local.name_prefix`) and add outputs for its name and ARN.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with DynamoDB table lifecycle actions scoped to
  `ff_dev_*`.
- New ADR via `/new-adr`: DynamoDB as the central datastore (key-value access by registrant pubkey, on-demand billing,
  the watermark co-located in the same table).

## Verification (QA)

- Terraform format check, and `init -backend=false` + `validate` for both roots — see the `build` skill.
- `terraform plan` then `apply` in `ff_dev` (local execution; `TF_CLOUD_ORGANIZATION` set).
- `terraform plan` for `ff_prod` is clean and additive.
- `aws sqs get-queue-attributes` reports `MessageRetentionPeriod = 1209600` on all four queues (both sources, both
  DLQs).
- `deno fmt` for the ADR and README index.

## Definition of done

- An on-demand DynamoDB table exists per environment, named from `local.name_prefix`, tagged by `default_tags`.
- Both registrants and confirmed queues, and their DLQs, retain messages for 14 days.
- `ff_dev`'s local IAM policy covers the new resources; `terraform apply` succeeds without a permissions error.
- `terraform plan` succeeds for `ff_prod`.
- The ADR is accepted and the README index updated.
