# 10 — Confirmed consumer / auditor (Node.js)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A long-running Node.js service that drains the confirmed queue and acts as an independent auditor: it re-derives truth
from the chain, cross-checks it against the central DynamoDB record, and marks the record `audited` only on a match.

## Depends on

- 09

## Changes

- `fragments/solana_register_sync/confirmed_consumer.ts` (+ `.test.ts`).

Behaviour:

- Per message, take **only the registrant pubkey** from the event payload. Everything else is re-derived: load the
  DynamoDB record, and load the on-chain `Registration` PDA via `getRegistrationAccount`.
- Cross-check that `registrant`, `registration_index` and `confirmed_at` all agree, and that the PDA's `confirmed_at` is
  actually set. Deliberately do not trust the event's own copy of these fields — that is the point of the audit.
- On a match: set status `audited` with an audited timestamp, publish nothing, delete the message.
- On a mismatch: throw. The message is not deleted, it retries, and after `maxReceiveCount` it lands in the confirmed
  queue's DLQ for inspection. Log enough to diagnose which field diverged.

This is the terminal state of the one audit subscriber in this iteration. Further subscribers would attach as their own
EventBridge rule and queue, not by competing on this one.

**Carried over from task 09 (added during its build):** give the auditor the same receive loop as
`registrants_consumer.ts`'s `consume`, including its fixed cadence:

- **One poll cycle every `POLL_INTERVAL_SECONDS`**: same name, same default (1800s, from
  `DEFAULT_POLL_INTERVAL_SECONDS`) and same validation (unset or empty means the default, `0` means back-to-back polls,
  anything but a non-negative integer fails startup). Each cycle handles at most one message, then sleeps whatever the
  queue holds. Both consumers then read one ConfigMap key and can be tuned together for testing.
- The rest of the loop shape: one message per receive (`MaxNumberOfMessages: 1`, 20s long poll), a failed receive that
  just ends the cycle (no separate backoff), and an `AbortSignal` that cancels the long poll and the sleep but never an
  in-flight message.
- Read the payload through `RegistrationConfirmedDetail` from `events.ts`. Its `signature` is `null` when the
  registrants consumer found the registration already confirmed; the audit ignores it either way.
- Derive the record's key with `registrantKey` from `registrations_table.ts`, not a third private copy. Tests spell
  `REGISTRANT#<pubkey>` out by hand, as `poller.test.ts` and `registrants_consumer.test.ts` do.

Whether to extract the loop into a shared helper (e.g. `consume(config, signal, handleMessage)`) or keep a second copy
is a build-time call. Two consumers is the point where the duplication starts to cost; a shared loop would also keep the
interval and shutdown tests in one place.

## Verification (QA)

- Node.js unit tests, `tsc`, `deno lint`, `deno fmt` — see the `build` skill. Requires the local stack
  (`docker compose --profile blockchain up`).
- **Chain is real, AWS is mocked.** AWS clients (SQS, DynamoDB) are `aws-sdk-client-mock` doubles; the `Registration`
  PDA is read from the local validator, as in task 07 — see the `build` skill's testing conventions (ADR 013).
- Test cases: matching record and PDA → `audited`; a `registration_index` mismatch → throws, no status change; a PDA
  with `confirmed_at` unset → throws; a missing DynamoDB record → throws.
- Locally against `ff_dev`: a real registration flows through to `audited`.
- Force a mismatch (e.g. hand-edit `registration_index` on the DynamoDB record before the message is consumed) and
  confirm the record is **not** audited and the message reaches the DLQ after the redrive count.

## Definition of done

- A confirmed registration is verified against the on-chain PDA and marked `audited`.
- A DynamoDB↔on-chain mismatch does not audit the record; the message retries and reaches the DLQ.
- The auditor re-reads the chain rather than trusting the event payload.
- Node.js tests, typecheck, lint and format pass.
