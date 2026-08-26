# 05 — EventBridge custom bus and rules to the existing queues

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

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
  - Rule matching detail-type `RegistrationDetected` → the `{env}_solana_register_registrants` queue. Named
    `registration_detected` (snake_case per repo convention) and left unprefixed — a rule is namespaced by its bus, and
    the bus name already carries `local.name_prefix`, so prefixing would render the ARN
    `rule/ff_dev_solana_register/ff_dev_solana_register_registration_detected`.
  - Rule matching detail-type `RegistrationConfirmed` → the `{env}_solana_register_registrants_confirmed` queue, named
    `registration_confirmed` on the same basis.
  - Outputs for the bus name and ARN — plus `solana_register_event_source`, **added during build**, so tasks 07/08 can
    wire the envelope's `source` from an output rather than re-declaring the literal.
- `fragments/terraform/ff_dev/tf_local_iam_policy.json` — extend with ~~`events:*` on `ff_dev_*` and the
  `sqs:SetQueueAttributes` / `sqs:AddPermission` needed to attach queue policies~~ **amended during build** on the
  user's ruling:
  - An **explicit EventBridge action list** rather than `events:*`, scoped to `event-bus/ff_dev_*` and `rule/ff_dev_*`.
    Both neighbouring statements in the file enumerate their actions, and the wildcard would have broken that
    least-privilege convention.
  - `sqs:AddPermission` is **not** needed and was not added: the provider's `aws_sqs_queue_policy` is a queue-attribute
    handler that writes the queue's `Policy` attribute, so it uses `sqs:SetQueueAttributes` — which the policy already
    granted from the earlier SQS work. Neither SQS bullet required a change.
  - `sqs:ReceiveMessage` / `sqs:DeleteMessage` on `ff_dev_*` were added instead, under their own Sid. The task's own
    `put-events` → `receive-message` verification cannot run without them, and the policy granted neither.
- `fragments/terraform/ff_prod/tf_remote_iam_apply_policy.json` and `tf_remote_iam_plan_policy.json` — **added during
  build** (scope widened on the user's ruling), following the identical precedent set in task 04: the same EventBridge
  lifecycle actions scoped to `ff_prod_*` on the apply role (minus `events:PutEvents`, which Terraform never calls), and
  the read-only subset (`DescribeEventBus`, `DescribeRule`, `ListTargetsByRule`, `ListTagsForResource`) on the plan
  role. No task in the spec extended the prod roles for EventBridge, so task 17's first prod apply would have failed on
  `events:CreateEventBus`. As in task 04 the gap is invisible to this task's own verification — prod `plan` needs no API
  read for resources absent from state.
- New ADR via `/new-adr`: an EventBridge-centred event architecture — producers publish to a bus, rules deliver to
  queues, and additional subscribers attach as their own rule + queue (fan-out) rather than competing on an existing
  queue.

Settle the event envelope here (`source`, `detail-type`, `detail`) since both the poller and the consumers encode
against it. Suggested `source`: `ff.solana.register`.

**Settled during build** — the suggested `source` was taken as-is, held in `local.solana_register_event_source` in each
root and surfaced as an output. It is deliberately not environment-scoped: the bus is already per environment, so the
source names the producing domain. Rules match on `source` **and** `detail-type`, and the `detail` shapes are:

- `RegistrationDetected` — `{ program_id, registrant, registration_index, registered_at }`
- `RegistrationConfirmed` — `{ program_id, registrant, registration_index, confirmed_at, signature }`

with `registered_at` / `confirmed_at` as on-chain slots and `signature` the confirming transaction. The envelope is
documented alongside the bus in both roots' `solana_register.tf` and in the ADR.

## Verification (QA)

- Terraform format check, `validate` both roots, `plan`/`apply` in `ff_dev`, `plan` clean for `ff_prod` — see the
  `build` skill.
- `aws events put-events` with a `RegistrationDetected` detail-type, then `aws sqs receive-message` on the registrants
  queue returns it.
- The same for `RegistrationConfirmed` against the confirmed queue.
- An event with an unmatched detail-type lands on neither queue.
- `deno fmt` for the ADR and README index.

**Run during build:** `terraform fmt -check -recursive` and `deno fmt` (both pass). Everything else on this list needs
AWS or the Terraform registry, which the agent sandbox blocks (the provider plugin cannot even be launched to load its
schema), so `validate`, `plan`, `apply` and the `put-events` → `receive-message` checks were left to the user to run.

## Definition of done

- A custom bus exists per environment with both rules routing to the correct queue.
- Queue policies grant send permission only to the specific rule ARN, not to `events.amazonaws.com` at large.
- Both detail-types are verified end to end with `put-events` → `receive-message`.
- `terraform plan` succeeds for `ff_prod`.
- The ADR is accepted and the README index updated.
