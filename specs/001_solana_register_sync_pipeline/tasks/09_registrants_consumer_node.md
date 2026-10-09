# 09 — Registrants consumer (Node.js)

**Status:** Done | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A long-running Node.js service that drains the registrants queue: ~~upsert the DynamoDB record,~~ sign
`confirm_registration` on-chain with the deployer authority, reconcile `confirmed_at` from chain onto the poller's
DynamoDB record (no upsert — see _Settled during build_), and publish a `RegistrationConfirmed` event. Runs as a plain
local process against the real `ff_dev` resources — containers and Kubernetes come later.

## Depends on

- 08

## Changes

- `fragments/solana_register_sync/registrants_consumer.ts` (+ `.test.ts`).
- `package.json` — add `@aws-sdk/client-sqs`.
- Reuse `confirmRegistration` and `getRegistrationAccount` from
  `fragments/solana_program_register/solana_register_interface.ts`.

Behaviour:

- Load the deployer keypair from Secrets Manager once at startup.
- Long-poll `ReceiveMessage` (20s wait) in a loop; handle `SIGTERM` by finishing the in-flight message then exiting, so
  a `kubectl scale --replicas=0` is clean.
- Per message: ~~upsert the `REGISTRANT#<pubkey>` record (idempotent),~~ call `confirm_registration`, and treat the
  `RegistrationAlreadyConfirmed` program error as **success** — it means a previous attempt landed. _No upsert: the
  poller awaits its `REGISTRANT#` write before publishing and throws on any failure other than "already exists", so
  every `RegistrationDetected` implies the record is committed. The consumer's one write is the `confirmed` update,
  which throws on a missing record instead (see below)._
- Re-read the on-chain `Registration` PDA and take `confirmed_at` from it rather than from the local clock or the event
  payload. Set the record's status to `confirmed`.
- Publish `RegistrationConfirmed` to the bus, then delete the message.
- On any error, do **not** delete the message: the visibility timeout returns it, and `maxReceiveCount` eventually
  routes it to the DLQ.

~~Configuration (queue URL, table, bus, program id, region, secret ARN) via environment variables — these become the
Kustomize `configMapGenerator` keys in task 14.~~ Configuration via environment variables, which become the Kustomize
`configMapGenerator` keys in task 14: `SOLANA_REGISTER_PROGRAM_ID`, `REGISTRANTS_QUEUE_URL`, `REGISTRATIONS_TABLE_NAME`,
`EVENT_BUS_NAME`, `EVENT_SOURCE`, `DEPLOYER_KEYPAIR_SECRET_ID` and `HELIUS_RPC_URL_SECRET_ID`, plus the optional
`POLL_INTERVAL_SECONDS` (see below). There are **two** secrets, not one: the chain in `ff_dev` / `ff_prod` is devnet via
Helius, so the consumer seeds `SOLANA_RPC_URL` from the RPC URL secret exactly as the poller does (task 06's consumer
policy already grants both). The region is the SDK's own `AWS_REGION`, not a custom key.

Settled during build:

- **Confirmation is polled over HTTP, not via `confirmRecentSignature`.** That helper's websocket client is hard-wired
  to `127.0.0.1:8900` and its RPC client is bound at import time — before the Helius URL is seeded — so against devnet
  it would wait on the wrong node. The consumer polls `getSignatureStatuses` instead, throwing on an on-chain error or
  after 20s (inside SQS's default 30s visibility timeout, which the queues keep).
- **`signature` in `RegistrationConfirmed` is `null` on the already-confirmed path.** The event envelope (task 05)
  carries the confirming transaction, but when `RegistrationAlreadyConfirmed` fires this attempt sent nothing and the
  earlier signature is not knowable without a history scan. The auditor (task 10) takes only the registrant from the
  payload, so nothing downstream depends on it. The record's `confirmation_signature` is SET only when the attempt has a
  real signature — never as null. An earlier `if_not_exists(confirmation_signature, :signature)` lost the signature when
  two consumers raced on one registrant: the loser's null landed first, and DynamoDB treats a NULL attribute as present,
  so the winner's real signature was kept out. Only one `confirm_registration` can succeed, so a real signature never
  overwrites another.
- **The upsert was dropped (a deviation from this file and requirements §D).** Those were written before the poller's
  write-before-publish ordering was settled (task 07); with it, the record exists for every message in a healthy system,
  and the upsert was a second write per message guarding only against out-of-band damage (a hand-deleted row, a
  hand-published event). That case now fails loudly instead: the `confirmed` write is conditional on
  `attribute_exists(pk) AND #status <> :audited` with `ReturnValuesOnConditionCheckFailure: ALL_OLD`, and a failure with
  no old item throws — the message retries into the DLQ, and `UpdateItem` never creates a partial row. The check runs
  after the on-chain confirmation, which is acceptable: `confirm_registration` only succeeds against a real
  `Registration` PDA, so the chain write is correct even when the off-chain record is not.
- **Replays never demote `audited`.** The same condition's `#status <> :audited` half leaves an audited record as is
  (the failure carries the old item, so it is told apart from a missing one); the message is still published and
  deleted.
- **Messages for another program id, or of another `detail-type`, are rejected** (thrown → retried → DLQ) rather than
  confirmed against the configured instance.
- **The detail-type constants moved to `fragments/solana_register_sync/events.ts`.** Importing them from `poller.ts`
  would have run the poller's module-level AWS client construction inside the consumer; `poller.ts` re-exports its
  constant, so its callers are unchanged. The two `detail` payload types live there too (`RegistrationDetectedDetail`,
  `RegistrationConfirmedDetail`): each producer builds its payload with `satisfies`, and each consumer reads through the
  same type, so a shape change on one side fails to compile on the other. They bind the TypeScript code and messages
  already on a queue are still held to the envelope by the Terraform comment and the tests' envelope assertions.
- **The table's key formats moved to `fragments/solana_register_sync/registrations_table.ts`** (`registrantKey`,
  `watermarkKey`), for the same reason: the poller and this consumer each defined `REGISTRANT#<pubkey>` privately, and a
  divergence would strand every message on a missing record. The tests keep spelling the formats out by hand rather than
  importing them, so they check the contract the stored rows depend on instead of agreeing with whatever the module
  says.
- **Startup fails fast** if the deployer keypair secret is not the registry authority, rather than failing every message
  into the DLQ.
- `package.json` gains `solana_register_sync:registrants_consumer` to run the process locally with `tsx`.
- **The consumer polls on a fixed cadence.** Each cycle is one 20s long poll that handles at most one message, then a
  sleep of `POLL_INTERVAL_SECONDS` — default **1800** (30 minutes) — whatever the queue holds. Against a poller that
  publishes at most once an hour, two cycles an hour keep up, and the consumer makes ~2 requests an hour rather than
  ~180. The cost is that a backlog drains at one message per cycle (~one per 15 minutes across the two unsynchronised
  replicas), and retries slow likewise — a failing message takes hours, not minutes, to reach the DLQ. `0` means
  back-to-back long polls, i.e. drain mode; any value that is not a non-negative integer fails startup. A failed receive
  simply ends the cycle, so there is no separate error backoff. The sleep is abortable, so `SIGTERM` still exits
  promptly, and a restart (`kubectl rollout restart`) runs a cycle immediately. Set a low value during testing for
  tighter latency. (An earlier version slept only after an empty poll and drained backlogs back to back; the fixed
  cadence was preferred as the simpler loop: one timing knob, one sleep, no special cases.)

## Verification (QA)

- Node.js unit tests, `tsc`, `deno lint`, `deno fmt` — see the `build` skill. Requires the local stack
  (`docker compose --profile blockchain up`).
- **Chain is real, AWS is mocked.** AWS clients (SQS, DynamoDB, EventBridge, Secrets Manager) are `aws-sdk-client-mock`
  doubles; `confirmRegistration` and `getRegistrationAccount` run against the local validator, as in task 07 — see the
  `build` skill's testing conventions (ADR 013).
- Test cases: happy path; `RegistrationAlreadyConfirmed` treated as success; a failed on-chain send leaves the message
  undeleted; re-processing the same message produces no duplicate row.
- Run locally with the scoped IAM user's credentials: register a test account, wait for the poller, and observe the
  DynamoDB record reach `confirmed`, `confirmed_at` set on-chain, and a message on the confirmed queue.

## Definition of done

- The consumer processes a registrant end to end: SQS → ~~DynamoDB →~~ on-chain `confirm_registration` → DynamoDB →
  EventBridge.
- `RegistrationAlreadyConfirmed` is handled as success; re-processing is idempotent with no duplicate rows.
- `confirmed_at` is reconciled from on-chain truth.
- A failure leaves the message on the queue for retry and, ultimately, the DLQ.
- `SIGTERM` shuts the loop down without abandoning an in-flight message.
