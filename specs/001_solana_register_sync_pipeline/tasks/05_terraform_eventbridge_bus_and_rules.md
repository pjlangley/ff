# 05 — EventBridge custom bus and rules to the existing queues

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

Each environment has a custom EventBridge bus with two rules routing structured events to the existing SQS queues, so
producers publish to the bus and never address a queue directly. This is the seam that lets future subscribers fan out
by adding a rule.

## Depends on

- 04 (same Terraform roots; keeps the IAM policy edits sequential)

## Changes

- `fragments/terraform/modules/eventbridge_rule_to_sqs/` — new shared module: an `aws_cloudwatch_event_rule` on a given
  bus and detail-type, an `aws_cloudwatch_event_target` pointing at a queue ARN, and the `aws_sqs_queue_policy` granting
  `events.amazonaws.com` `sqs:SendMessage` **scoped to that rule's ARN** via an `aws:SourceArn` condition.
- `fragments/terraform/ff_dev/solana_register.tf` and `ff_prod/solana_register.tf`:
  - `aws_cloudwatch_event_bus` named `${local.name_prefix}_solana_register`.
  - Rule `RegistrationDetected` → the `{env}_solana_register_registrants` queue.
  - Rule `RegistrationConfirmed` → the `{env}_solana_register_registrants_confirmed` queue.
  - Outputs for the bus name and ARN.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with `events:*` on `ff_dev_*` and the
  `sqs:SetQueueAttributes` / `sqs:AddPermission` needed to attach queue policies.
- New ADR via `/new-adr`: an EventBridge-centred event architecture — producers publish to a bus, rules deliver to
  queues, and additional subscribers attach as their own rule + queue (fan-out) rather than competing on an existing
  queue.

Settle the event envelope here (`source`, `detail-type`, `detail`) since both the poller and the consumers encode
against it. Suggested `source`: `ff.solana.register`.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod` — see the
  `build` skill.
- `aws events put-events` with a `RegistrationDetected` detail-type, then `aws sqs receive-message` on the registrants
  queue returns it.
- The same for `RegistrationConfirmed` against the confirmed queue.
- An event with an unmatched detail-type lands on neither queue.
- `deno fmt` for the ADR and README index.

## Definition of done

- A custom bus exists per environment with both rules routing to the correct queue.
- Queue policies grant send permission only to the specific rule ARN, not to `events.amazonaws.com` at large.
- Both detail-types are verified end to end with `put-events` → `receive-message`.
- `terraform plan` succeeds for `ff_prod`.
- The ADR is accepted and the README index updated.
