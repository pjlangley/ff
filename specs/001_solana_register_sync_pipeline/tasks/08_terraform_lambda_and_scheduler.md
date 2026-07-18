# 08 — Lambda + EventBridge Scheduler (chain to queue, end to end)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

The poller runs in AWS on a daytime schedule, so registering a test account on devnet results in a message landing on
the registrants queue with no manual step. This is the first end-to-end slice: chain → queue.

## Depends on

- 04, 05, 06, 07

## Changes

- Lambda packaging: bundle `poller.ts` to a single file and zip it with Terraform's `archive_file` data source.
  `esbuild` as a new devDependency is the cleanest route; reusing the existing `tsc` output plus production
  `node_modules` also works but produces a much larger artifact. **Decide at build time.**
- `fragments/terraform/ff_dev/` and `ff_prod/`:
  - `aws_lambda_function` (Node.js 22 runtime, `architectures = ["arm64"]` — Graviton Lambda is cheaper per GB-second
    and the bundle is pure JavaScript, so there is no native-module reason to stay on x86_64). Its IAM role and policy:
    DynamoDB read+write on the table, `events:PutEvents` on the bus, `secretsmanager:GetSecretValue` on the Helius
    secret, and CloudWatch Logs.
  - `aws_cloudwatch_log_group` with a short retention (cost).
  - `aws_scheduler_schedule` with a cron expression and `schedule_expression_timezone = "Europe/London"` so the daytime
    window is DST-safe, plus its invoke role. Flexible time window off.
  - Lambda environment: table name, bus name, program id, Helius secret ARN.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with Lambda, IAM role, Scheduler and Logs actions
  scoped to `ff_dev_*`.

**Open at build time:** the exact cron cadence and window hours. Throughput is bounded by the poll interval since the
poller ingests one registration per invocation, so pick a cadence that drains a small backlog within the window.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod`.
- `aws lambda invoke` against a registry with no new registrations logs a no-op and publishes nothing.
- Register a test account against the **dev** program on devnet, then invoke the Lambda: a `RegistrationDetected` event
  is published and `aws sqs receive-message` returns it from `ff_dev_solana_register_registrants`.
- Invoke a second time: no new message, and the watermark item in DynamoDB is unchanged.
- CloudWatch Logs show the ingest and the watermark advance.

## Definition of done

- The poller is deployed and invoked on an `Europe/London` daytime cron in both environments.
- A devnet registration is ingested and lands on the registrants queue without manual intervention.
- A second invocation with no new registrations is a clean no-op.
- The Lambda reads the Helius URL from Secrets Manager, not a plaintext env var.
- `terraform plan` succeeds for `ff_prod`.
