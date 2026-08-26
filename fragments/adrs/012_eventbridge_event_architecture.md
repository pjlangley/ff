# EventBridge-centred event architecture for the register sync pipeline

**Status:** Accepted | **Date:** 2026-08-25

## Context and Problem Statement

The register sync pipeline (spec 001) has two producers — the Lambda poller, which detects a new on-chain registration,
and the registrants consumer, which confirms one on-chain — and their output is consumed by SQS-backed Kubernetes
services. Producers could simply `sqs:SendMessage` to the queue their consumer polls, which is the shortest path and one
fewer AWS service. The question this record settles is whether the queue is the producer's interface at all, or whether
producers publish an event to a broker that decides which queues it lands in.

The requirements name the confirmed consumer as the **first** subscriber to confirmed registrations, with the explicit
expectation that a real product grows more. Under competing consumers, a second subscriber cannot share the first one's
queue — it would steal messages from it rather than receive a copy.

## Considered Options

- Producers write directly to SQS with `sqs:SendMessage`
- A custom EventBridge bus per environment, with rules routing to the existing SQS queues

## Decision Outcome

Chosen option: "a custom EventBridge bus per environment", because it puts the routing decision in infrastructure rather
than in the producer, so adding the second subscriber the requirements anticipate is a Terraform rule plus a queue — no
change to, or redeploy of, the code that emits the event.

Each environment gets a `${local.name_prefix}_solana_register` bus carrying a settled envelope:

- `source` — `ff.solana.register`, identifying the producing domain (not the environment; the bus is already per
  environment).
- `detail-type` — `RegistrationDetected` or `RegistrationConfirmed`.
- `detail` — the registration payload: `program_id`, `registrant`, `registration_index`, and `registered_at` or
  `confirmed_at` (on-chain slots) plus the confirming `signature`.

Two rules match on `source` + `detail-type` and deliver to the existing registrants and confirmed queues. Each rule
carries its own `sqs:SendMessage` grant on the target queue, conditioned on `aws:SourceArn` equalling **that rule's**
ARN — the queue is not opened to `events.amazonaws.com` generally, which would let any rule in any account write to it.

Direct `sqs:SendMessage` was rejected because it hard-codes the topology into the producer: the confirmed event's second
subscriber would mean editing and redeploying the registrants consumer to send to two queues, and every producer would
need a queue URL per destination. EventBridge is also already the service behind the poller's schedule (EventBridge
Scheduler) and the prod overnight pause, so routing through a bus introduces no service the pipeline does not already
depend on.

The extra complexity is accepted knowingly, and partly for its own sake: this is an educational portfolio, and building
a broker-and-rules topology first-hand — the envelope contract, the pattern matching, the per-rule queue grant — is a
goal of the exercise, not just a means to an end. On this iteration's traffic alone (a handful of events a day, one
subscriber per event type) a direct `sqs:SendMessage` would have been sufficient; the fan-out argument above is an
anticipated need rather than a present one.

### Consequences

- Good, because a new subscriber is a rule + queue in Terraform — the fan-out the requirements anticipate needs no
  producer change and cannot steal messages from an existing consumer
- Good, because producers hold one bus name and an envelope contract instead of a queue URL per destination, so their
  IAM grant is a single `events:PutEvents` on the bus
- Good, because routing is declared in Terraform and reviewable in a diff, rather than implied by which queue URL some
  service happened to be configured with
- Good, because the per-rule `aws:SourceArn` condition keeps each queue's send permission scoped to exactly one rule
- Neutral, because the envelope (`source` / `detail-type` / `detail`) becomes a contract shared by the poller and both
  consumer implementations in each language — it is settled in Terraform but enforced only by the code that encodes
  against it
- Bad, because the hop adds a service to the path: a mis-typed `detail-type` produces an event that matches no rule and
  is silently dropped, with no queue and no DLQ to inspect (EventBridge charges nothing for it either, so cost gives no
  signal)
- Bad, because delivery is now two-stage, so debugging a missing message means checking the rule's match as well as the
  queue — where a direct send would have failed loudly at the producer

## More Information

- Shared module: [`modules/eventbridge_rule_to_sqs`](../terraform/modules/eventbridge_rule_to_sqs/main.tf) — rule,
  target and the scoped queue policy. It assumes one rule per queue, which the fan-out design guarantees: a queue shared
  by two rules would need their grants merged into a single policy document.
- Bus and rules per environment in [`ff_dev`](../terraform/ff_dev/solana_register.tf) and
  [`ff_prod`](../terraform/ff_prod/solana_register.tf); the envelope is documented alongside them.
- Feature spec:
  [`specs/001_solana_register_sync_pipeline`](../../specs/001_solana_register_sync_pipeline/requirements.md) (sections B
  and D), task 05.
