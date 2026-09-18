# 09 — Registrants consumer (Node.js)

**Status:** Todo | **Feature:** [001_solana_register_sync_pipeline](../requirements.md)

## Goal

A long-running Node.js service that drains the registrants queue: upsert the DynamoDB record, sign
`confirm_registration` on-chain with the deployer authority, reconcile `confirmed_at` from chain, and publish a
`RegistrationConfirmed` event. Runs as a plain local process against the real `ff_dev` resources — containers and
Kubernetes come later.

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
- Per message: upsert the `REGISTRANT#<pubkey>` record (idempotent), call `confirm_registration`, and treat the
  `RegistrationAlreadyConfirmed` program error as **success** — it means a previous attempt landed.
- Re-read the on-chain `Registration` PDA and take `confirmed_at` from it rather than from the local clock or the event
  payload. Set the record's status to `confirmed`.
- Publish `RegistrationConfirmed` to the bus, then delete the message.
- On any error, do **not** delete the message: the visibility timeout returns it, and `maxReceiveCount` eventually
  routes it to the DLQ.

Configuration (queue URL, table, bus, program id, region, secret ARN) via environment variables — these become the
Kustomize `configMapGenerator` keys in task 14.

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

- The consumer processes a registrant end to end: SQS → DynamoDB → on-chain `confirm_registration` → EventBridge.
- `RegistrationAlreadyConfirmed` is handled as success; re-processing is idempotent with no duplicate rows.
- `confirmed_at` is reconciled from on-chain truth.
- A failure leaves the message on the queue for retry and, ultimately, the DLQ.
- `SIGTERM` shuts the loop down without abandoning an in-flight message.
